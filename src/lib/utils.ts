import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- CSV/JSON utilities used by DatasetUpload ----
export function toCSV(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  const headers = Array.from(new Set(items.flatMap(obj => Object.keys(obj || {}))));
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const lines = [headers.join(',')];
  for (const it of items) {
    lines.push(headers.map(h => esc((it as any)[h])).join(','));
  }
  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCSV(filename: string, rows: any[]) {
  const csv = toCSV(rows);
  downloadFile(filename, csv, 'text/csv');
}

export function downloadJSON(filename: string, rows: any[]) {
  const json = JSON.stringify(rows, null, 2);
  downloadFile(filename, json, 'application/json');
}
