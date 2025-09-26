export interface TrainRow {
  trainId: string;
  fitnessCerts?: string; // Valid | Conditional | Expired | Revoked
  workOrders?: string;   // Closed | Open | Critical | Major | Minor | Cosmetic
  mileageStatus?: string; // Balanced | Overrun | Underrun
  wrapExposure?: string; // OnTarget | Behind | None
  cleaningSlot?: string; // Available | NotAvailable
  stabling?: string;     // Optimal | Moderate | Poor
  // Optional richer fields if available in CSV/DB
  tte_r_hours?: number;
  tte_s_hours?: number;
  tte_t_hours?: number;
  job_severity?: ('critical'|'major'|'minor'|'cosmetic')[];
  job_age_hours?: number[]; // aligned with job_severity
  branding_target_hours?: number;
  branding_achieved_hours?: number;
  blackout?: boolean;
  cleaning_class_required?: 'A'|'B'|'C';
  last_clean_hours_ago?: number;
  detailing_prebooked?: boolean;
  shunt_minutes?: number;
  shunt_moves?: number;
  shunt_minutes_max_p90?: number;
  shunt_moves_max_p90?: number;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function callWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Disabled remote calls: using local scoring only
export async function callOpenRouter(_prompt: string): Promise<string> {
  throw new Error('Remote scoring disabled');
}

export async function callGroq(_prompt: string): Promise<string> {
  throw new Error('Remote scoring disabled');
}

// Simple local fallback using baseline weights. Replace with full formulas when inputs are available.
export function localScoring(row: TrainRow): number {
  let score = 0;
  // Fitness (35)
  const fitness = (row.fitnessCerts || '').toLowerCase();
  if (fitness === 'valid') score += 35;
  else if (fitness === 'conditional') score += 21; // 60% cap notionally

  // Job Cards (20)
  const wo = (row.workOrders || '').toLowerCase();
  if (wo === 'closed') score += 20;
  else if (wo === 'major') score += 8;
  else if (wo === 'minor') score += 14;
  else if (wo === 'cosmetic') score += 18;

  // Mileage (15)
  const mileage = (row.mileageStatus || '').toLowerCase();
  if (mileage === 'balanced') score += 15;
  else if (mileage === 'underrun') score += 13;
  else if (mileage === 'overrun') score += 10;

  // Branding (12)
  const branding = (row.wrapExposure || '').toLowerCase();
  if (branding === 'ontarget') score += 12; else if (branding === 'behind') score += 9; else score += 6;

  // Cleaning (10)
  const cleaning = (row.cleaningSlot || '').toLowerCase();
  if (cleaning === 'available') score += 10; else score += 4;

  // Geometry (8)
  const stab = (row.stabling || '').toLowerCase();
  if (stab === 'optimal') score += 8; else if (stab === 'moderate') score += 6; else score += 4;

  return Math.round(score * 100) / 100;
}

// Full scoring per provided formulas with graceful fallbacks
export interface ScoringContext {
  comfortWindowHrs?: number; // H, default 72
  dailyTargetKm?: number; // K, default 100
  fleetAvgKm30d?: number; // mean for mileage balancing
}

export function computeScore(row: TrainRow, ctx: ScoringContext = {}): { total: number; blocked: boolean; parts: Record<string, number>; } {
  const H = ctx.comfortWindowHrs ?? 72;
  const K = ctx.dailyTargetKm ?? 100;

  // -------- Hard gates --------
  const fitnessTxt = (row.fitnessCerts || '').toLowerCase();
  const workTxt = (row.workOrders || '').toLowerCase();
  const cleanTxt = (row.cleaningSlot || '').toLowerCase();
  const hardBlocked = (
    fitnessTxt.includes('expired') || fitnessTxt.includes('revoked') ||
    workTxt.includes('critical') ||
    cleanTxt.includes('bio') || cleanTxt.includes('notavailable')
  );
  if (hardBlocked) {
    return { total: 0, blocked: true, parts: { fitness: 0, jobs: 0, mileage: 0, branding: 0, cleaning: 0, geometry: 0 } };
  }

  // -------- 1) Fitness (35) --------
  let sR = 0, sS = 0, sT = 0;
  const tteOr = (x?: number) => (typeof x === 'number' && isFinite(x) ? Math.max(0, x) : undefined);
  const tR = tteOr(row.tte_r_hours);
  const tS = tteOr(row.tte_s_hours);
  const tT = tteOr(row.tte_t_hours);
  const statusIsConditional = fitnessTxt.includes('conditional');

  const calcS = (t?: number) => {
    if (t === undefined) return fitnessTxt.includes('valid') ? 1 : statusIsConditional ? 0.6 : 0; // fallback
    const base = Math.min(1, t / H);
    return statusIsConditional ? Math.min(base, 0.6) : base;
  };
  sR = calcS(tR);
  sS = calcS(tS);
  sT = calcS(tT);
  let fitnessScore = 35 * Math.min(sR, sS, sT);
  if (tR !== undefined && tS !== undefined && tT !== undefined) {
    if (tR >= 2*H && tS >= 2*H && tT >= 2*H) fitnessScore = Math.min(35, fitnessScore + 3);
  }

  // -------- 2) Job Cards (20) --------
  let jobsScore = 20;
  if (row.job_severity && row.job_severity.length) {
    const aging = row.job_age_hours || [];
    const agingPenalty = (h: number) => h < 24 ? 1.0 : h <= 72 ? 0.8 : h <= 24*7 ? 0.6 : 0.4;
    const sevVal = (s: string) => s === 'critical' ? 0 : s === 'major' ? 0.4 : s === 'minor' ? 0.7 : 0.9;
    let rmin = 1.0;
    row.job_severity.forEach((sev, idx) => {
      const r = sevVal(sev) * agingPenalty(aging[idx] ?? 0);
      rmin = Math.min(rmin, r);
    });
    jobsScore = 20 * rmin;
    const subsystemsMajor = row.job_severity.filter(s => s === 'major').length;
    if (subsystemsMajor >= 2) jobsScore *= 0.85;
  } else {
    // Fallback mapping from text
    if (workTxt.includes('open') || workTxt.includes('major')) jobsScore = 20 * 0.4;
    else if (workTxt.includes('minor') || workTxt.includes('pending')) jobsScore = 20 * 0.7;
    else if (workTxt.includes('cosmetic')) jobsScore = 20 * 0.9;
    else jobsScore = 20;
  }

  // -------- 3) Mileage (15) --------
  let mileageScore = 15;
  const fleetAvg = ctx.fleetAvgKm30d ?? 0;
  if (fleetAvg > 0 && typeof (row as any).mileage === 'number') {
    const delta = ((row as any).mileage as number) - fleetAvg;
    if (Math.abs(delta) <= 0.2 * K) mileageScore = 15;
    else {
      const val = 1 - (Math.abs(delta) - 0.2 * K) / (0.8 * K);
      mileageScore = 15 * Math.max(0, val);
    }
    if (delta < 0) mileageScore = Math.min(15, mileageScore + 3);
  }

  // -------- 4) Branding (12) --------
  let brandingScore = 6; // neutral for unwrapped
  if (row.blackout) brandingScore = 0;
  else if (row.branding_target_hours && row.branding_achieved_hours !== undefined) {
    const T = row.branding_target_hours || 0;
    const A = row.branding_achieved_hours || 0;
    const g = T > 0 ? Math.max(0, (T - A) / T) : 0;
    brandingScore = 6 + 6 * g;
    brandingScore = Math.min(12, brandingScore);
  } else {
    // Fallback mapping
    const wrap = (row.wrapExposure || '').toLowerCase();
    if (wrap === 'behind') brandingScore = 10;
    else if (wrap === 'ontarget') brandingScore = 8;
    else brandingScore = 6;
  }

  // -------- 5) Cleaning (10) --------
  let cleaningScore = 10;
  if (row.cleaning_class_required && row.last_clean_hours_ago !== undefined) {
    const Hc = row.cleaning_class_required === 'A' ? 24 : row.cleaning_class_required === 'B' ? 48 : 96;
    const h = row.last_clean_hours_ago;
    const s = Math.min(1, 1 - 0.5 * Math.max(0, (h - 0.5 * Hc) / Hc));
    cleaningScore = 10 * s;
    if (row.detailing_prebooked) cleaningScore *= 0.7;
  } else {
    // Fallback
    cleaningScore = (row.cleaningSlot || '').toLowerCase() === 'available' ? 10 : 6;
  }

  // -------- 6) Geometry (8) --------
  let geometryScore = 6; // fallback neutral
  if (row.shunt_minutes !== undefined && row.shunt_moves !== undefined && row.shunt_minutes_max_p90 && row.shunt_moves_max_p90) {
    const M = row.shunt_minutes || 0;
    const m = row.shunt_moves || 0;
    const Mmax = row.shunt_minutes_max_p90 || 1;
    const mmax = row.shunt_moves_max_p90 || 1;
    const val = 0.7 * (1 - M / Mmax) + 0.3 * (1 - m / mmax);
    geometryScore = Math.max(0, Math.min(8, 8 * val));
  }

  const total = Math.round((fitnessScore + jobsScore + mileageScore + brandingScore + cleaningScore + geometryScore) * 100) / 100;
  return { total, blocked: false, parts: { fitness: fitnessScore, jobs: jobsScore, mileage: mileageScore, branding: brandingScore, cleaning: cleaningScore, geometry: geometryScore } };
}

export async function runScoring(prompt: string, row: TrainRow): Promise<number | string> {
  // Always use local scoring per requirement (no external APIs)
  return localScoring(row);
}

export function buildPromptFromRow(row: TrainRow): string {
  return `
Train ID: ${row.trainId}
Fitness Certs: ${row.fitnessCerts ?? 'Unknown'}
Work Orders: ${row.workOrders ?? 'Unknown'}
Wrap Exposure: ${row.wrapExposure ?? 'Unknown'}
Mileage: ${row.mileageStatus ?? 'Unknown'}
Cleaning: ${row.cleaningSlot ?? 'Unknown'}
Stabling: ${row.stabling ?? 'Unknown'}

Calculate induction score out of 100 based on the 6-factor formula.
Provide a single number as the first token in your reply.`.trim();
}


