#!/usr/bin/env python3
"""
Flask backend service: NSGA-II multi-objective ranking for Kochi Metro trains.

Endpoints
- POST /rank
  Content-Type: application/json
  {
    "weights": { "fitness": 5.0, "jobs": 2.0, "branding": 1.5, "mileage": 1.0, "cleaning": 1.25, "stabling": 0.75 },
    "rows": [
      {
        "train_id": "Train05",
        "fitness": "valid",               # valid | invalid | expired
        "job_cards": "closed",             # open | closed | minor | major | critical
        "branding": "medium",              # high | medium | low
        "mileage": 121000,                  # number (km) used to compute deviation
        "cleaning": "complete",            # complete | pending
        "stabling": "bay2",                # bay label or empty
        "updated_at": "2025-09-19T13:57:53Z"
      },
      ...
    ]
  }

  Returns
  {
    "results": [
      {
        "train_id": "Train05",
        "score": 94.0,                    # optional scalar (heuristic)
        "fitness": "Valid",
        "job_card_status": "Closed",
        "branding_priority": "Medium",
        "mileage": 121000,
        "cleaning_status": "Complete",
        "stabling_position": "Bay2",
        "induction_category": "Revenue Service",   # Revenue Service | Standby | IBL
        "nsga_rank": 1,
        "nsga_crowding": 1.23,
        "updated_at": "2025-09-19T13:57:53Z"
      }
    ]
  }

Notes
- Uses pymoo's non-dominated sorting if available; otherwise falls back to a built-in implementation.
- Objectives are minimized; text inputs are mapped to numeric proxies with dataset-driven normalization.
- Weights are applied to normalized objectives for sorting and crowding computation.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple, Optional

from flask import Flask, request, jsonify
try:
    from flask_cors import CORS  # type: ignore
except Exception:
    CORS = None
import os
import json
import time

try:
    from pymoo.util.nds.non_dominated_sorting import NonDominatedSorting  # type: ignore
    _HAVE_PYMOO = True
except Exception:
    _HAVE_PYMOO = False


app = Flask(__name__)
if CORS:
    CORS(app)


# ------------------------------ Mapping helpers ----------------------------- #

def _norm(vals: List[float]) -> List[float]:
    if not vals:
        return vals
    vmin, vmax = min(vals), max(vals)
    if vmax - vmin == 0:
        return [0.0 for _ in vals]
    return [(v - vmin) / (vmax - vmin) for v in vals]


def _norm_text(s: Any) -> str:
    return str(s or '').strip().lower()


def _normalize_statuses(row: Dict[str, Any]) -> Dict[str, Any]:
    f = _norm_text(row.get("fitness"))
    if "valid" in f:
        fitness = "Valid"
    elif any(k in f for k in ["expired", "invalid", "revoked"]):
        fitness = "Expired"
    else:
        fitness = "Conditional"

    j = _norm_text(row.get("job_cards"))
    if any(k in j for k in ["critical", "major", "open"]):
        jobs = "Open"
    elif any(k in j for k in ["minor", "pending"]):
        jobs = "Minor"
    else:
        jobs = "Closed"

    b = _norm_text(row.get("branding"))
    if b == "high":
        branding = "High"
    elif b == "medium":
        branding = "Medium"
    else:
        branding = "Low"

    c = _norm_text(row.get("cleaning"))
    if any(k in c for k in ["complete", "clean"]):
        cleaning = "Complete"
    elif any(k in c for k in ["partial", "inprogress"]):
        cleaning = "Partial"
    else:
        cleaning = "Pending"

    stabling = row.get("stabling") or ""

    return {
        "fitness": fitness,
        "job_cards": jobs,
        "branding": branding,
        "cleaning": cleaning,
        "stabling": stabling,
    }


def map_row_to_objectives(row: Dict[str, Any], fleet_avg_mileage: float) -> Tuple[List[float], Dict[str, Any], float, Dict[str, Any]]:
    norm = _normalize_statuses(row)
    # 1) Fitness (minimize invalidity)
    ftxt = _norm_text(norm.get("fitness"))
    fitness_invalid = 1.0 if ("invalid" in ftxt or "expired" in ftxt or "revoked" in ftxt) else 0.0

    # 2) Jobs (open/closed -> severity proxy; minimize severity)
    jtxt = _norm_text(norm.get("job_cards"))
    if any(k in jtxt for k in ["critical", "major", "open"]):
        jobs = 1.0
    elif any(k in jtxt for k in ["minor", "pending"]):
        jobs = 0.5
    else:
        jobs = 0.0

    # 3) Branding (high/medium/low -> minimize lag behind)
    btxt = _norm_text(norm.get("branding"))
    branding = 1.0 if btxt == "high" else 0.5 if btxt == "medium" else 0.0

    # 4) Mileage deviation from fleet average (minimize deviation)
    mileage = float(row.get("mileage") or 0.0)
    mileage_dev = abs(mileage - float(fleet_avg_mileage))

    # 5) Cleaning need (pending=1, complete=0)
    ctxt = _norm_text(norm.get("cleaning"))
    cleaning_need = 0.0 if ("complete" in ctxt or "clean" in ctxt) else (0.5 if "partial" in ctxt else 1.0)

    # 6) Stabling geometry (bay present -> better)
    stab = str(norm.get("stabling", "")).strip()
    geometry = 0.0 if stab else 0.5

    # Penalty for hard constraint violation (invalid fitness)
    penalty = 10.0 if fitness_invalid > 0 else 0.0

    objectives = [fitness_invalid, jobs, branding, mileage_dev, cleaning_need, geometry]
    extras = {
        "fitness": norm.get("fitness"),
        "job_card_status": norm.get("job_cards"),
        "branding_priority": norm.get("branding"),
        "mileage": mileage,
        "cleaning_status": norm.get("cleaning"),
        "stabling_position": norm.get("stabling"),
        "updated_at": row.get("updated_at"),
    }
    # Alerts/flags for UI
    alerts = {
        "fitness_invalid": bool(fitness_invalid),
        "job_open": jtxt in ("open") or any(k in jtxt for k in ["major", "critical"]),
        "cleaning_pending": "pending" in ctxt,
        "cleaning_partial": "partial" in ctxt,
        "no_stabling": not bool(stab),
    }
    return objectives, extras, penalty, alerts


def apply_weights(objs: List[List[float]], weights: Dict[str, float]) -> List[List[float]]:
    w_f = weights.get("fitness", 5.0)
    w_j = weights.get("jobs", 2.0)
    w_b = weights.get("branding", 1.5)
    w_m = weights.get("mileage", 1.0)
    w_c = weights.get("cleaning", 1.25)
    w_s = weights.get("stabling", 0.75)
    out: List[List[float]] = []
    # Normalize each column first
    cols = list(zip(*objs)) if objs else []
    cols_norm = [_norm(list(col)) for col in cols]
    for i in range(len(objs)):
        n = [cols_norm[k][i] for k in range(len(cols_norm))]
        out.append([
            n[0] * w_f,
            n[1] * w_j,
            n[2] * w_b,
            n[3] * w_m,
            n[4] * w_c,
            n[5] * w_s,
        ])
    return out


# ---------------------------- NSGA-II ranking ------------------------------- #

def _dominates(a: List[float], b: List[float]) -> bool:
    not_worse = all(x <= y for x, y in zip(a, b))
    strictly_better = any(x < y for x, y in zip(a, b))
    return not_worse and strictly_better


def _non_dominated_sort(pop: List[List[float]]) -> List[List[int]]:
    n = len(pop)
    S = [[] for _ in range(n)]
    n_dom = [0 for _ in range(n)]
    fronts: List[List[int]] = []
    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if _dominates(pop[p], pop[q]):
                S[p].append(q)
            elif _dominates(pop[q], pop[p]):
                n_dom[p] += 1
    current = [i for i in range(n) if n_dom[i] == 0]
    if current:
        fronts.append(current)
    while current:
        next_front: List[int] = []
        for p in current:
            for q in S[p]:
                n_dom[q] -= 1
                if n_dom[q] == 0:
                    next_front.append(q)
        current = next_front
        if current:
            fronts.append(current)
    return fronts


def _crowding_distance(front: List[int], pop: List[List[float]]) -> Dict[int, float]:
    if not front:
        return {}
    m = len(pop[0])
    dist = {i: 0.0 for i in front}
    for k in range(m):
        sorted_idx = sorted(front, key=lambda i: pop[i][k])
        min_v = pop[sorted_idx[0]][k]
        max_v = pop[sorted_idx[-1]][k]
        span = max_v - min_v
        dist[sorted_idx[0]] = math.inf
        dist[sorted_idx[-1]] = math.inf
        if span == 0:
            continue
        for j in range(1, len(sorted_idx) - 1):
            prev_v = pop[sorted_idx[j - 1]][k]
            next_v = pop[sorted_idx[j + 1]][k]
            dist[sorted_idx[j]] += (next_v - prev_v) / span
    return dist


def nsga_order(weighted_objs: List[List[float]], constraint_penalties: List[float]) -> List[Tuple[int, float, int]]:
    # Constraint-domination: feasible (penalty=0) dominates infeasible
    # Among infeasible, less penalty dominates; otherwise use standard NSGA-II.
    # returns list of (index, -crowding, rank)
    if _HAVE_PYMOO:
        # pymoo's NonDominatedSorting does not directly handle constraints here,
        # so we pre-order by feasibility and then apply nds within groups.
        feas_idx = [i for i,p in enumerate(constraint_penalties) if p <= 0]
        infeas_idx = [i for i,p in enumerate(constraint_penalties) if p > 0]
        fronts: List[List[int]] = []
        if feas_idx:
            feas_objs = [weighted_objs[i] for i in feas_idx]
            nds = NonDominatedSorting(method="fast_non_dominated_sort")
            feas_fronts = nds.do(feas_objs, only_non_dominated_front=False)
            fronts.extend([[feas_idx[j] for j in f] for f in feas_fronts])
        if infeas_idx:
            # order infeasible by penalty, then apply NDS as tie-breaker
            grouped = sorted(infeas_idx, key=lambda i: constraint_penalties[i])
            nds = NonDominatedSorting(method="fast_non_dominated_sort")
            inf_objs = [weighted_objs[i] for i in grouped]
            inf_fronts = nds.do(inf_objs, only_non_dominated_front=False)
            fronts.extend([[grouped[j] for j in f] for f in inf_fronts])
    else:
        # fallback: build fronts with feasibility first
        feas_idx = [i for i,p in enumerate(constraint_penalties) if p <= 0]
        infeas_idx = [i for i,p in enumerate(constraint_penalties) if p > 0]
        fronts = []
        if feas_idx:
            fronts.extend(_non_dominated_sort([weighted_objs[i] for i in feas_idx]))
            fronts = [[feas_idx[j] for j in f] for f in fronts]
        if infeas_idx:
            inf_fronts = _non_dominated_sort([weighted_objs[i] for i in infeas_idx])
            fronts.extend([[infeas_idx[j] for j in f] for f in inf_fronts])
    ranks: Dict[int, int] = {}
    order: List[Tuple[int, float, int]] = []
    rank_num = 1
    for f in fronts:
        for i in f:
            ranks[i] = rank_num
        d = _crowding_distance(f, weighted_objs)
        for i in f:
            order.append((i, -(d.get(i, 0.0)), ranks[i]))
        rank_num += 1
    order.sort(key=lambda t: (t[2], t[1]))  # rank asc, crowding desc (negated)
    return order


# ---------------------------- Classification ------------------------------- #

def classify_row(raw: Dict[str, Any]) -> str:
    f = str(raw.get("fitness", "")).lower()
    j = str(raw.get("job_cards", "")).lower()
    c = str(raw.get("cleaning", "")).lower()
    invalid = ("invalid" in f or "expired" in f or "revoked" in f)
    open_jobs = any(k in j for k in ["critical", "major", "open"])
    if invalid and open_jobs:
        return "IBL"
    if "pending" in c:
        return "Standby"
    return "Revenue Service"


def compute_scores_heuristic(rows: List[Dict[str, Any]], fleet_avg: float) -> List[float]:
    # Simple scalar score (0..100) for display; does not affect NSGA order
    scores: List[float] = []
    for r in rows:
        score = 0.0
        score += 35.0 if str(r.get("fitness", "")).lower().find("valid") >= 0 else 21.0
        job = str(r.get("job_cards", "")).lower()
        if "closed" in job:
            score += 20.0
        elif any(k in job for k in ["minor", "pending"]):
            score += 14.0
        elif any(k in job for k in ["major", "critical", "open"]):
            score += 8.0
        branding = str(r.get("branding", "")).lower()
        score += 12.0 if branding in ("low", "medium", "ontarget") else 9.0
        mileage = float(r.get("mileage") or 0.0)
        delta = abs(mileage - fleet_avg)
        score += 15.0 if delta <= 100 else max(0.0, 15.0 - (delta - 100.0) / 1000.0 * 5.0)
        clean = str(r.get("cleaning", "")).lower()
        score += 10.0 if ("complete" in clean or "clean" in clean) else 6.0
        stab = str(r.get("stabling", ""))
        score += 8.0 if stab else 6.0
        scores.append(round(score, 2))
    return scores


# -------------------------- Explainability & LLMs --------------------------- #

def _get_env_or(payload: Dict[str, Any], key: str, env_key: str) -> Optional[str]:
    k = payload.get(key)
    if isinstance(k, str) and k.strip():
        return k.strip()
    v = os.getenv(env_key)
    return v.strip() if v else None


def build_explanation_prompt(item: Dict[str, Any]) -> str:
    return (
        "You are an operations planner for a metro fleet. "
        "Given one train's nightly ranking context, write a concise 3-5 sentence explanation: "
        "1) summarize fitness status and any hard constraints, "
        "2) explain influences of job cards, branding exposure, mileage deviation, cleaning status, and stabling geometry, "
        "3) justify the NSGA-II rank and the final induction category. Use neutral, decision-grade language.\n\n"
        f"Train ID: {item.get('train_id')}\n"
        f"Fitness: {item.get('fitness_certificate_status')}\n"
        f"Job Cards: {item.get('job_card_status')}\n"
        f"Branding: {item.get('branding_priority')}\n"
        f"Mileage: {item.get('mileage')}\n"
        f"Cleaning: {item.get('cleaning_status')}\n"
        f"Stabling: {item.get('stabling_position')}\n"
        f"NSGA Rank: {item.get('nsga_rank')}\n"
        f"Category: {item.get('induction_category')}\n"
        f"Alerts: fitness_invalid={item.get('alert_fitness_invalid')}, job_open={item.get('alert_job_open')}, "
        f"cleaning_pending={item.get('alert_cleaning_pending')}, cleaning_partial={item.get('alert_cleaning_partial')}, "
        f"no_stabling={item.get('alert_no_stabling')}\n"
        "Explain succinctly."
    )


def call_openrouter_explain(prompt: str, api_key: str) -> Optional[str]:
    try:
        import requests
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "anthropic/claude-3.5-sonnet",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        res = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, data=json.dumps(payload), timeout=12)
        if not res.ok:
            return None
        data = res.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content")
    except Exception:
        return None


def call_groq_summarize(text: str, api_key: str) -> Optional[str]:
    # Optional accelerator: compress the reasoning for UI
    try:
        import requests
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "llama-3.1-70b-versatile",
            "messages": [{"role": "user", "content": f"Summarize in 2 sentences for UI: {text}"}],
            "temperature": 0.2,
        }
        res = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, data=json.dumps(payload), timeout=10)
        if not res.ok:
            return None
        data = res.json()
        return data.get("choices", [{}])[0].get("message", {}).get("content")
    except Exception:
        return None


# ------------------------- Explanation Generation ------------------------ #

def generate_basic_explanation(item: Dict[str, Any], alerts: Dict[str, bool]) -> str:
    """Generate a basic explanation for the train ranking without requiring API keys."""
    train_id = item.get("train_id", "This train")
    fitness = item.get("fitness_certificate_status", "Unknown")
    jobs = item.get("job_card_status", "Unknown")
    branding = item.get("branding_priority", "Unknown")
    mileage = item.get("mileage", 0)
    cleaning = item.get("cleaning_status", "Unknown")
    stabling = item.get("stabling_position", "Not assigned")
    rank = item.get("pareto_rank", "N/A")
    
    # Build explanation based on status
    explanation_parts = []
    
    # Fitness status
    if "valid" in str(fitness).lower():
        explanation_parts.append(f"Fitness certificate is valid")
    elif any(x in str(fitness).lower() for x in ["expired", "invalid", "revoked"]):
        explanation_parts.append(f"Fitness certificate is {fitness.lower()}")
    else:
        explanation_parts.append(f"Fitness certificate status: {fitness}")
    
    # Job cards
    if "closed" in str(jobs).lower():
        explanation_parts.append("no open job cards")
    elif any(x in str(jobs).lower() for x in ["open", "major", "critical"]):
        explanation_parts.append(f"has {jobs.lower()} job cards")
    else:
        explanation_parts.append(f"job card status: {jobs}")
    
    # Branding
    if str(branding).lower() == "high":
        explanation_parts.append("high branding priority")
    elif str(branding).lower() == "medium":
        explanation_parts.append("medium branding priority")
    else:
        explanation_parts.append(f"branding priority: {branding}")
    
    # Mileage
    explanation_parts.append(f"mileage: {mileage:,} km")
    
    # Cleaning
    if "complete" in str(cleaning).lower() or "clean" in str(cleaning).lower():
        explanation_parts.append("cleaning complete")
    elif "pending" in str(cleaning).lower():
        explanation_parts.append("cleaning pending")
    else:
        explanation_parts.append(f"cleaning status: {cleaning}")
    
    # Stabling
    if stabling and stabling != "Not assigned":
        explanation_parts.append(f"stabled at {stabling}")
    else:
        explanation_parts.append("no stabling position assigned")
    
    # Alerts
    alert_parts = []
    if alerts.get("fitness_invalid"):
        alert_parts.append("Fitness invalid")
    if alerts.get("job_open"):
        alert_parts.append("Open job cards")
    if alerts.get("cleaning_pending"):
        alert_parts.append("Cleaning pending")
    if alerts.get("cleaning_partial"):
        alert_parts.append("Cleaning partial")
    if alerts.get("no_stabling"):
        alert_parts.append("No stabling")
    
    # Combine explanation
    base_explanation = f"{train_id} is ranked {rank}. " + ", ".join(explanation_parts) + "."
    
    if alert_parts:
        base_explanation += f" Alerts: {', '.join(alert_parts)}."
    
    return base_explanation

# ------------------------- Conflict/Violation Checks ------------------------ #

def detect_conflicts(item: Dict[str, Any]) -> List[str]:
    alerts: List[str] = []
    fitness = _norm_text(item.get("fitness_certificate_status"))
    jobs = _norm_text(item.get("job_card_status"))
    cleaning = _norm_text(item.get("cleaning_status"))
    stabling = str(item.get("stabling_position") or "")

    if any(k in fitness for k in ["expired", "invalid", "revoked"]):
        alerts.append("Fitness certificate invalid/expired: assign to Inspection Bay and block induction.")
    # Domain-specific placeholder: telecom clearance check could be modeled as a flag in input rows
    if _norm_text(item.get("telecom_clearance")) in ("missing", "expired"):
        alerts.append("Telecom clearance missing/expired: request immediate validation before movement.")
    if any(k in jobs for k in ["open", "major", "critical"]):
        alerts.append("Open or critical job cards present: review and schedule maintenance.")
    if cleaning not in ("complete", "clean"):
        alerts.append("Cleaning not complete: allocate slot or defer induction.")
    if not stabling:
        alerts.append("No stabling bay assigned: allocate bay to reduce shunting time.")
    return alerts

# --------------------------------- API ------------------------------------- #

@app.post("/rank")
def rank_endpoint():
    payload = request.get_json(force=True, silent=False)
    if not payload or "rows" not in payload:
        return jsonify({"error": "missing rows"}), 400

    rows: List[Dict[str, Any]] = payload["rows"]
    weights: Dict[str, float] = payload.get("weights", {})
    openrouter_key = _get_env_or(payload, "openrouter_api_key", "OPENROUTER_API_KEY")
    groq_key = _get_env_or(payload, "groq_api_key", "GROQ_API_KEY")

    # Compute fleet average mileage
    mileages = [float(r.get("mileage") or 0.0) for r in rows]
    fleet_avg = sum(mileages) / (len(mileages) or 1)

    # Objectives (raw) and extras
    raw_objs: List[List[float]] = []
    extras_list: List[Dict[str, Any]] = []
    penalties: List[float] = []
    alerts_list: List[Dict[str, Any]] = []
    for r in rows:
        obj, extras, penalty, alerts = map_row_to_objectives(r, fleet_avg)
        raw_objs.append(obj)
        extras_list.append(extras)
        penalties.append(penalty)
        alerts_list.append(alerts)

    weighted = apply_weights(raw_objs, weights)
    order = nsga_order(weighted, penalties)
    scores = compute_scores_heuristic(rows, fleet_avg)

    # Build response in dashboard shape
    results: List[Dict[str, Any]] = []
    for sort_idx, (_, neg_crowd, rank) in enumerate(order):
        i = order[sort_idx][0]
        base = rows[i]
        extras = extras_list[i]
        # Induction category with hard constraint
        category = "Revenue Service"
        if alerts_list[i]["fitness_invalid"]:
            category = "Inspection Bay Hold"
        elif alerts_list[i]["cleaning_pending"] or alerts_list[i]["cleaning_partial"]:
            category = "Cleaning/Detailing"

        result_item = {
            "train_id": base.get("train_id"),
            "pareto_rank": rank,
            "fitness_certificate_status": extras["fitness"],
            "job_card_status": extras["job_card_status"],
            "branding_priority": extras["branding_priority"],
            "mileage": extras["mileage"],
            "cleaning_status": extras["cleaning_status"],
            "stabling_position": extras["stabling_position"],
            "updated_at": extras["updated_at"]
        }

        # Conflict detection messages
        conflicts = detect_conflicts(result_item)
        if conflicts:
            result_item["conflicts"] = conflicts

        # Generate explanation based on train data
        explanation = generate_basic_explanation(result_item, alerts_list[i])
        result_item["explanation"] = explanation
        
        # Add alerts as JSON string for database storage
        result_item["alerts"] = json.dumps({
            "fitness_invalid": alerts_list[i]["fitness_invalid"],
            "job_open": alerts_list[i]["job_open"],
            "cleaning_pending": alerts_list[i]["cleaning_pending"],
            "cleaning_partial": alerts_list[i]["cleaning_partial"],
            "no_stabling": alerts_list[i]["no_stabling"]
        })

        results.append(result_item)

    return jsonify({"results": results})


if __name__ == "__main__":
    # For local testing:  python backend_nsga_service.py
    # Then POST to http://127.0.0.1:5001/rank
    app.run(host="127.0.0.1", port=5001, debug=True)


