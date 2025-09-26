export type ObjectiveVector = number[]; // all minimized

export interface NSGAItem<T = any> {
  data: T;
  objectives: ObjectiveVector; // already normalized/weighted as needed
  rank?: number; // Pareto front (1 = best)
  crowding?: number;
}

function dominates(a: ObjectiveVector, b: ObjectiveVector): boolean {
  let strictlyBetter = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > b[i]) return false; // worse on a minimization objective
    if (a[i] < b[i]) strictlyBetter = true;
  }
  return strictlyBetter;
}

function nonDominatedSort<T>(items: NSGAItem<T>[]): number[][] {
  const n = items.length;
  const S: number[][] = Array.from({ length: n }, () => []);
  const nDom: number[] = Array.from({ length: n }, () => 0);
  const fronts: number[][] = [];

  for (let p = 0; p < n; p++) {
    for (let q = 0; q < n; q++) {
      if (p === q) continue;
      if (dominates(items[p].objectives, items[q].objectives)) {
        S[p].push(q);
      } else if (dominates(items[q].objectives, items[p].objectives)) {
        nDom[p] += 1;
      }
    }
  }

  let current: number[] = [];
  for (let i = 0; i < n; i++) if (nDom[i] === 0) { items[i].rank = 1; current.push(i); }
  if (current.length) fronts.push(current);

  let rank = 1;
  while (current.length) {
    const next: number[] = [];
    for (const p of current) {
      for (const q of S[p]) {
        nDom[q] -= 1;
        if (nDom[q] === 0) { items[q].rank = rank + 1; next.push(q); }
      }
    }
    rank += 1;
    current = next;
    if (current.length) fronts.push(current);
  }
  return fronts;
}

function crowdingDistance<T>(items: NSGAItem<T>[], indices: number[]): void {
  if (indices.length === 0) return;
  const m = items[indices[0]].objectives.length;
  for (const i of indices) items[i].crowding = 0;
  for (let k = 0; k < m; k++) {
    const sorted = [...indices].sort((a, b) => items[a].objectives[k] - items[b].objectives[k]);
    const minVal = items[sorted[0]].objectives[k];
    const maxVal = items[sorted[sorted.length - 1]].objectives[k];
    const span = maxVal - minVal;
    items[sorted[0]].crowding = Number.POSITIVE_INFINITY;
    items[sorted[sorted.length - 1]].crowding = Number.POSITIVE_INFINITY;
    if (span === 0) continue;
    for (let i = 1; i < sorted.length - 1; i++) {
      const prev = items[sorted[i - 1]].objectives[k];
      const next = items[sorted[i + 1]].objectives[k];
      items[sorted[i]].crowding = (items[sorted[i]].crowding || 0) + (next - prev) / span;
    }
  }
}

export function nsgaRank<T>(items: NSGAItem<T>[]): NSGAItem<T>[] {
  const fronts = nonDominatedSort(items);
  for (const f of fronts) crowdingDistance(items, f);
  return items.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.crowding ?? 0) - (a.crowding ?? 0));
}

// Simple helper to min-max normalize vectors per dimension
export function normalizeObjectives(rows: number[][]): number[][] {
  if (rows.length === 0) return rows;
  const m = rows[0].length;
  const mins = Array(m).fill(Number.POSITIVE_INFINITY);
  const maxs = Array(m).fill(Number.NEGATIVE_INFINITY);
  for (const r of rows) {
    for (let i = 0; i < m; i++) { mins[i] = Math.min(mins[i], r[i]); maxs[i] = Math.max(maxs[i], r[i]); }
  }
  const out: number[][] = rows.map(r => r.slice());
  for (let i = 0; i < out.length; i++) {
    for (let k = 0; k < m; k++) {
      const span = maxs[k] - mins[k];
      out[i][k] = span === 0 ? 0 : (out[i][k] - mins[k]) / span;
    }
  }
  return out;
}


