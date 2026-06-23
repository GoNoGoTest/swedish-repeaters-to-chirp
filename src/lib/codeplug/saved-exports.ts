/**
 * Sparade SK6BA-exporter i localStorage.
 * Max 5 senaste behålls. Dubbletter (samma filnamn + identiskt innehåll)
 * skrivs över; samma filnamn med nytt innehåll versioneras (_v2, _v3, …).
 */

import { z } from "zod";

const KEY = "sk6ba:exports:v1";
const MAX_ENTRIES = 5;

export interface SavedExport {
  id: string;
  filename: string;
  savedAt: number; // epoch ms
  rowCount: number;
  byteSize: number;
  content: string; // raw CSV text
}

const savedExportSchema = z.object({
  id: z.string().min(1),
  filename: z.string().min(1),
  savedAt: z.number(),
  rowCount: z.number().int().min(0),
  byteSize: z.number().int().min(0),
  content: z.string(),
});
const savedExportListSchema = z.array(savedExportSchema);

function safeRead(): SavedExport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtrera bort entries som inte matchar schemat istället för att kasta hela listan.
    const valid: SavedExport[] = [];
    for (const item of parsed) {
      const check = savedExportSchema.safeParse(item);
      if (check.success) valid.push(check.data);
    }
    const all = savedExportListSchema.safeParse(valid);
    return all.success ? all.data : [];
  } catch {
    return [];
  }
}

function safeWrite(list: SavedExport[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota: ignore */
  }
}

export function listSavedExports(): SavedExport[] {
  return safeRead().sort((a, b) => b.savedAt - a.savedAt);
}

function versionFilename(base: string, existing: SavedExport[]): string {
  const sameName = existing.filter(
    (e) => e.filename === base || e.filename.startsWith(stripExt(base) + "_v"),
  );
  if (sameName.length === 0) return base;
  const stem = stripExt(base);
  const ext = base.slice(stem.length);
  let n = 2;
  while (existing.some((e) => e.filename === `${stem}_v${n}${ext}`)) n++;
  return `${stem}_v${n}${ext}`;
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

export function saveExport(input: {
  filename: string;
  content: string;
  rowCount: number;
}): SavedExport {
  const list = safeRead();
  const existingSame = list.find(
    (e) => e.filename === input.filename && e.content === input.content,
  );
  if (existingSame) {
    existingSame.savedAt = Date.now();
    safeWrite(list);
    return existingSame;
  }
  // Same filename, different content → version it.
  const sameName = list.some((e) => e.filename === input.filename);
  const finalName = sameName ? versionFilename(input.filename, list) : input.filename;

  const entry: SavedExport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: finalName,
    savedAt: Date.now(),
    rowCount: input.rowCount,
    byteSize: new Blob([input.content]).size,
    content: input.content,
  };
  const next = [entry, ...list].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_ENTRIES);
  safeWrite(next);
  return entry;
}

export function deleteExport(id: string): void {
  safeWrite(safeRead().filter((e) => e.id !== id));
}

export function clearAllExports(): void {
  safeWrite([]);
}

export type Freshness = "fresh" | "stale" | "old";

export function freshnessOf(savedAt: number, now: number = Date.now()): Freshness {
  const days = (now - savedAt) / (1000 * 60 * 60 * 24);
  if (days < 7) return "fresh";
  if (days < 21) return "stale";
  return "old";
}

export function relativeTime(savedAt: number, now: number = Date.now()): string {
  const sec = Math.max(1, Math.round((now - savedAt) / 1000));
  if (sec < 60) return "nyss";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min sedan`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? "timme" : "timmar"} sedan`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days} ${days === 1 ? "dag" : "dagar"} sedan`;
  const months = Math.round(days / 30);
  return `${months} mån sedan`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
