#!/usr/bin/env python3
"""
NSGA-II multi-objective ranking for Kochi Metro trainsets.

- Accepts input for six interdependent variables per trainset
  1) Fitness Certificates validity (binary)
  2) Job-Card Status (open or closed work orders)
  3) Branding Priorities (exterior wrap exposure hours)
  4) Mileage Balancing (km allocation balancing wear items)
  5) Cleaning & Detailing Slots (availability of manpower/bays)
  6) Stabling Geometry (bay positions minimizing shunting/turn-out time)

- Computes normalized objective vector for each trainset
  By default, all objectives are formulated as minimization.

- Ranks trainsets using NSGA-II non-dominated sorting with crowding distance
  to approximate Pareto front ordering.

- Classifies trainsets into three categories based on constraints and thresholds:
  - Ready for revenue service
  - Scheduled for cleaning/detailing
  - Held back in Inspection Bay for maintenance

- Provides CLI for reading CSV inputs, writing CSV outputs, and adjusting
  weights/targets/thresholds without changing core code.

This script intentionally implements the NSGA-II ordering (fronts + crowding)
for clarity and keeps hooks for explainability metadata per trainset.
"""

from __future__ import annotations

import argparse
import csv
import math
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any


# ----------------------------- Data Structures ----------------------------- #

@dataclass
class TrainInput:
    train_id: str
    fitness_valid: bool  # True if FC valid
    open_work_orders: int  # count of open job-cards
    branding_hours_remaining: float  # hours remaining to meet exposure target (lower is better)
    mileage_km: float  # cumulative mileage this period or total mileage used for balancing
    mileage_target_km: float  # target mileage to balance wear vs fleet
    cleaning_need_score: float  # 0-1 or 0-100 indicating how dirty; higher => needs cleaning
    cleaning_slot_available: bool  # if slot/manpower available today/tonight
    stabling_move_minutes: float  # time to move to/from bay; lower is better


@dataclass
class ObjectiveConfig:
    # All objectives are modeled as minimization targets. Weights allow emphasis.
    weight_fitness_invalid: float = 5.0
    weight_open_work_orders: float = 2.0
    weight_branding_hours: float = 1.5
    weight_mileage_deviation: float = 1.0
    weight_cleaning_need: float = 1.25
    weight_stabling_move: float = 0.75

    # Normalization denominators (to bring variables into comparable scales).
    # If zero or None, dynamic normalization is applied from dataset stats.
    norm_open_work_orders: Optional[float] = None
    norm_branding_hours: Optional[float] = None
    norm_mileage_deviation: Optional[float] = None
    norm_cleaning_need: Optional[float] = None
    norm_stabling_move: Optional[float] = None


@dataclass
class ClassificationThresholds:
    max_open_work_orders_for_ready: int = 0
    max_cleaning_need_for_ready: float = 0.3  # 0..1 scale
    max_stabling_move_for_ready: float = 10.0  # minutes

    cleaning_need_threshold: float = 0.5  # above this, prioritize cleaning if slot
    maintenance_open_work_orders_threshold: int = 1  # if >= and FC invalid -> maintenance


@dataclass
class TrainComputed:
    train: TrainInput
    # Objective vector (minimize all):
    #   [fitness_invalid, open_work_orders, branding_hours_remaining,
    #    abs(mileage_km - mileage_target_km), cleaning_need_score, stabling_move_minutes]
    objectives: List[float] = field(default_factory=list)
    # Weighted + normalized objectives for scalar checks/inspection if needed
    weighted_objectives: List[float] = field(default_factory=list)
    # Non-dominated sorting info
    domination_count: int = 0
    dominated_set: List[int] = field(default_factory=list)
    rank: Optional[int] = None  # Pareto front index starting at 1
    crowding_distance: float = 0.0
    # Explainability store (key/value reasons)
    reasons: Dict[str, Any] = field(default_factory=dict)


# ---------------------------- Utility Functions ---------------------------- #

def read_csv(path: str) -> List[TrainInput]:
    trains: List[TrainInput] = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                trains.append(
                    TrainInput(
                        train_id=str(row["train_id"]).strip(),
                        fitness_valid=str(row["fitness_valid"]).strip().lower() in {"1", "true", "yes", "y"},
                        open_work_orders=int(row["open_work_orders"]),
                        branding_hours_remaining=float(row["branding_hours_remaining"]),
                        mileage_km=float(row["mileage_km"]),
                        mileage_target_km=float(row["mileage_target_km"]),
                        cleaning_need_score=float(row["cleaning_need_score"]),
                        cleaning_slot_available=str(row["cleaning_slot_available"]).strip().lower() in {"1", "true", "yes", "y"},
                        stabling_move_minutes=float(row["stabling_move_minutes"]),
                    )
                )
            except KeyError as e:
                raise ValueError(f"Missing required CSV column: {e}")
    return trains


def sample_data() -> List[TrainInput]:
    # Generate 25 sample trainsets with varied values
    data: List[TrainInput] = []
    for i in range(1, 26):
        data.append(
            TrainInput(
                train_id=f"T{i:02d}",
                fitness_valid=(i % 7 != 0),
                open_work_orders=(i % 4),
                branding_hours_remaining=max(0.0, 100 - 3.5 * i),
                mileage_km=10000 + 300 * i,
                mileage_target_km=10600 + (50 * ((i % 5) - 2)),
                cleaning_need_score=min(1.0, ((i % 10) / 10.0) + (0.05 if i % 3 == 0 else 0.0)),
                cleaning_slot_available=(i % 2 == 0),
                stabling_move_minutes=5 + (i % 12),
            )
        )
    return data


def compute_objectives(
    trains: List[TrainInput],
    cfg: ObjectiveConfig,
) -> List[TrainComputed]:
    # Dynamic normalization denominators from dataset if not provided
    eps = 1e-9
    max_open = max((t.open_work_orders for t in trains), default=1)
    max_branding = max((t.branding_hours_remaining for t in trains), default=1.0)
    max_mileage_dev = max((abs(t.mileage_km - t.mileage_target_km) for t in trains), default=1.0)
    max_clean = max((t.cleaning_need_score for t in trains), default=1.0)
    max_stable = max((t.stabling_move_minutes for t in trains), default=1.0)

    n_open = cfg.norm_open_work_orders or max(1.0, float(max_open))
    n_brand = cfg.norm_branding_hours or max(1.0, float(max_branding))
    n_mileage = cfg.norm_mileage_deviation or max(1.0, float(max_mileage_dev))
    n_clean = cfg.norm_cleaning_need or max(1.0, float(max_clean))
    n_stable = cfg.norm_stabling_move or max(1.0, float(max_stable))

    computed: List[TrainComputed] = []
    for t in trains:
        fitness_invalid = 0.0 if t.fitness_valid else 1.0
        mileage_dev = abs(t.mileage_km - t.mileage_target_km)

        obj = [
            fitness_invalid,  # minimize invalidity
            t.open_work_orders / (n_open + eps),
            t.branding_hours_remaining / (n_brand + eps),
            mileage_dev / (n_mileage + eps),
            t.cleaning_need_score / (n_clean + eps),
            t.stabling_move_minutes / (n_stable + eps),
        ]

        weighted = [
            obj[0] * cfg.weight_fitness_invalid,
            obj[1] * cfg.weight_open_work_orders,
            obj[2] * cfg.weight_branding_hours,
            obj[3] * cfg.weight_mileage_deviation,
            obj[4] * cfg.weight_cleaning_need,
            obj[5] * cfg.weight_stabling_move,
        ]

        computed.append(TrainComputed(train=t, objectives=obj, weighted_objectives=weighted))
    return computed


# -------------------------- NSGA-II Core Procedures ------------------------ #

def dominates(a: List[float], b: List[float]) -> bool:
    # All objectives are minimize
    not_worse_all = all(x <= y for x, y in zip(a, b))
    strictly_better_any = any(x < y for x, y in zip(a, b))
    return not_worse_all and strictly_better_any


def non_dominated_sort(pop: List[TrainComputed]) -> List[List[int]]:
    n = len(pop)
    fronts: List[List[int]] = []
    S: List[List[int]] = [[] for _ in range(n)]
    n_dom: List[int] = [0 for _ in range(n)]

    for p in range(n):
        for q in range(n):
            if p == q:
                continue
            if dominates(pop[p].weighted_objectives, pop[q].weighted_objectives):
                S[p].append(q)
            elif dominates(pop[q].weighted_objectives, pop[p].weighted_objectives):
                n_dom[p] += 1

    current_front = [i for i in range(n) if n_dom[i] == 0]
    for i in current_front:
        pop[i].rank = 1
    fronts.append(current_front)

    rank = 1
    while current_front:
        next_front: List[int] = []
        for p in current_front:
            for q in S[p]:
                n_dom[q] -= 1
                if n_dom[q] == 0:
                    pop[q].rank = rank + 1
                    next_front.append(q)
        rank += 1
        current_front = next_front
        if current_front:
            fronts.append(current_front)

    return fronts


def crowding_distance(pop: List[TrainComputed], indices: List[int]) -> None:
    if not indices:
        return
    m = len(pop[indices[0]].weighted_objectives)
    for i in indices:
        pop[i].crowding_distance = 0.0

    for obj_idx in range(m):
        indices_sorted = sorted(indices, key=lambda idx: pop[idx].weighted_objectives[obj_idx])
        min_val = pop[indices_sorted[0]].weighted_objectives[obj_idx]
        max_val = pop[indices_sorted[-1]].weighted_objectives[obj_idx]
        span = max_val - min_val

        pop[indices_sorted[0]].crowding_distance = math.inf
        pop[indices_sorted[-1]].crowding_distance = math.inf

        if span == 0:
            continue

        for j in range(1, len(indices_sorted) - 1):
            prev_val = pop[indices_sorted[j - 1]].weighted_objectives[obj_idx]
            next_val = pop[indices_sorted[j + 1]].weighted_objectives[obj_idx]
            pop[indices_sorted[j]].crowding_distance += (next_val - prev_val) / span


def nsga_rank(pop: List[TrainComputed]) -> List[TrainComputed]:
    fronts = non_dominated_sort(pop)
    for front in fronts:
        crowding_distance(pop, front)
    # Sort by (rank asc, crowding desc)
    pop_sorted = sorted(pop, key=lambda x: (x.rank if x.rank is not None else math.inf, -x.crowding_distance))
    return pop_sorted


# ------------------------- Classification & Reasons ------------------------ #

def classify(
    ranked: List[TrainComputed],
    thresholds: ClassificationThresholds,
) -> List[Tuple[TrainComputed, str]]:
    results: List[Tuple[TrainComputed, str]] = []
    for item in ranked:
        t = item.train
        # Base reasons
        item.reasons["fitness_valid"] = t.fitness_valid
        item.reasons["open_work_orders"] = t.open_work_orders
        item.reasons["branding_hours_remaining"] = t.branding_hours_remaining
        item.reasons["mileage_deviation"] = abs(t.mileage_km - t.mileage_target_km)
        item.reasons["cleaning_need_score"] = t.cleaning_need_score
        item.reasons["cleaning_slot_available"] = t.cleaning_slot_available
        item.reasons["stabling_move_minutes"] = t.stabling_move_minutes
        item.reasons["pareto_rank"] = item.rank
        item.reasons["crowding_distance"] = item.crowding_distance

        category: str
        if not t.fitness_valid and t.open_work_orders >= thresholds.maintenance_open_work_orders_threshold:
            category = "Inspection Bay: Maintenance"
        elif t.cleaning_need_score >= thresholds.cleaning_need_threshold and t.cleaning_slot_available:
            category = "Cleaning/Detailing"
        else:
            # Ready if good constraints
            ready = (
                t.fitness_valid
                and t.open_work_orders <= thresholds.max_open_work_orders_for_ready
                and t.cleaning_need_score <= thresholds.max_cleaning_need_for_ready
                and t.stabling_move_minutes <= thresholds.max_stabling_move_for_ready
            )
            category = "Revenue Service" if ready else "Revenue Service (Monitor)"

        results.append((item, category))
    return results


# ------------------------------- I/O Helpers ------------------------------- #

def write_csv(path: str, rows: List[Tuple[TrainComputed, str]]) -> None:
    fieldnames = [
        "train_id",
        "category",
        "pareto_rank",
        "crowding_distance",
        "fitness_valid",
        "open_work_orders",
        "branding_hours_remaining",
        "mileage_deviation",
        "cleaning_need_score",
        "cleaning_slot_available",
        "stabling_move_minutes",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for item, category in rows:
            t = item.train
            writer.writerow(
                {
                    "train_id": t.train_id,
                    "category": category,
                    "pareto_rank": item.rank,
                    "crowding_distance": item.crowding_distance,
                    "fitness_valid": t.fitness_valid,
                    "open_work_orders": t.open_work_orders,
                    "branding_hours_remaining": t.branding_hours_remaining,
                    "mileage_deviation": abs(t.mileage_km - t.mileage_target_km),
                    "cleaning_need_score": t.cleaning_need_score,
                    "cleaning_slot_available": t.cleaning_slot_available,
                    "stabling_move_minutes": t.stabling_move_minutes,
                }
            )


# --------------------------------- CLI Main -------------------------------- #

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="NSGA-II ranking for Kochi Metro trainsets")
    p.add_argument("--input-csv", type=str, default="", help="Path to input CSV. If omitted, uses sample data.")
    p.add_argument("--output-csv", type=str, default="train_ranking.csv", help="Path to write ranked output CSV.")

    # Weights
    p.add_argument("--w-fitness", type=float, default=5.0)
    p.add_argument("--w-jobs", type=float, default=2.0)
    p.add_argument("--w-brand", type=float, default=1.5)
    p.add_argument("--w-mileage", type=float, default=1.0)
    p.add_argument("--w-clean", type=float, default=1.25)
    p.add_argument("--w-stable", type=float, default=0.75)

    # Thresholds for classification
    p.add_argument("--ready-max-open", type=int, default=0)
    p.add_argument("--ready-max-clean", type=float, default=0.3)
    p.add_argument("--ready-max-stable", type=float, default=10.0)
    p.add_argument("--clean-threshold", type=float, default=0.5)
    p.add_argument("--maint-open-threshold", type=int, default=1)

    # Optional explicit normalizers
    p.add_argument("--norm-open", type=float, default=float("nan"))
    p.add_argument("--norm-brand", type=float, default=float("nan"))
    p.add_argument("--norm-mileage", type=float, default=float("nan"))
    p.add_argument("--norm-clean", type=float, default=float("nan"))
    p.add_argument("--norm-stable", type=float, default=float("nan"))

    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    if args.input_csv:
        trains = read_csv(args.input_csv)
    else:
        trains = sample_data()

    cfg = ObjectiveConfig(
        weight_fitness_invalid=args.w_fitness,
        weight_open_work_orders=args.w_jobs,
        weight_branding_hours=args.w_brand,
        weight_mileage_deviation=args.w_mileage,
        weight_cleaning_need=args.w_clean,
        weight_stabling_move=args.w_stable,
        norm_open_work_orders=(None if math.isnan(args.norm_open) else args.norm_open),
        norm_branding_hours=(None if math.isnan(args.norm_brand) else args.norm_brand),
        norm_mileage_deviation=(None if math.isnan(args.norm_mileage) else args.norm_mileage),
        norm_cleaning_need=(None if math.isnan(args.norm_clean) else args.norm_clean),
        norm_stabling_move=(None if math.isnan(args.norm_stable) else args.norm_stable),
    )

    thresholds = ClassificationThresholds(
        max_open_work_orders_for_ready=args.ready_max_open,
        max_cleaning_need_for_ready=args.ready_max_clean,
        max_stabling_move_for_ready=args.ready_max_stable,
        cleaning_need_threshold=args.clean_threshold,
        maintenance_open_work_orders_threshold=args.maint_open_threshold,
    )

    computed = compute_objectives(trains, cfg)
    ranked = nsga_rank(computed)
    categorized = classify(ranked, thresholds)

    write_csv(args.output_csv, categorized)

    # Console preview
    print("TrainID, Category, Rank, Crowding, Fitness, OpenWO, BrandHours, MileageDev, CleanNeed, CleanSlot, StableMove")
    for item, cat in categorized:
        t = item.train
        print(
            f"{t.train_id}, {cat}, {item.rank}, {item.crowding_distance:.3f}, "
            f"{t.fitness_valid}, {t.open_work_orders}, {t.branding_hours_remaining:.1f}, "
            f"{abs(t.mileage_km - t.mileage_target_km):.1f}, {t.cleaning_need_score:.2f}, "
            f"{t.cleaning_slot_available}, {t.stabling_move_minutes:.1f}"
        )

    print(f"\nWrote: {args.output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


