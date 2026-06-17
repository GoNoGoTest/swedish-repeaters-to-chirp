import Papa from "papaparse";
import type { RawRow } from "../models";

const EXPECTED_COLS = [
  "id","updated","type","band","mode","network","network_id","district",
  "call","city","channel","output","tx_shift","access","status",
  "lat","lng","locator","masl","magl","watt_pep","dir","ant","backup",
];

export interface ImportResult {
  rows: RawRow[];
  columns: string[];
  missingColumns: string[];
  delimiter: string;
}

export function parseSk6baCsv(text: string): ImportResult {
  // strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const result = Papa.parse<RawRow>(text, {
    header: true,
    delimiter: "",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const columns = result.meta.fields ?? [];
  const missingColumns = EXPECTED_COLS.filter((c) => !columns.includes(c));

  return {
    rows: result.data,
    columns,
    delimiter: result.meta.delimiter,
    missingColumns,
  };
}

/**
 * High-level load state for SK6BA CSV. Used by UI to either present a
 * loaded dataset, an explicit error (with missing column names), or the
 * initial empty state. `parseSk6baCsv` stays unchanged for the low-level
 * pipeline; this wrapper adds the validation step the UI needs.
 */
export type Sk6baLoadState =
  | { status: "empty" }
  | {
      status: "loaded";
      rows: RawRow[];
      columns: string[];
      rowCount: number;
      summary: Summary;
    }
  | { status: "error"; message: string; missingColumns?: string[] };

export function loadSk6baCsv(text: string): Sk6baLoadState {
  let parsed: ImportResult;
  try {
    parsed = parseSk6baCsv(text);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
  if (parsed.columns.length === 0) {
    return { status: "error", message: "Filen verkar tom eller saknar rubrikrad." };
  }
  if (parsed.missingColumns.length > 0) {
    return {
      status: "error",
      message: `Saknade obligatoriska kolumner: ${parsed.missingColumns.join(", ")}`,
      missingColumns: parsed.missingColumns,
    };
  }
  if (parsed.rows.length === 0) {
    return { status: "error", message: "Inga rader i filen efter rubrikraden." };
  }
  return {
    status: "loaded",
    rows: parsed.rows,
    columns: parsed.columns,
    rowCount: parsed.rows.length,
    summary: summarize(parsed.rows, parsed.columns),
  };
}

export function parseNumberLoose(v: string | undefined | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const normalized = s.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export interface Summary {
  totalRows: number;
  columns: string[];
  uniqueCounts: Record<string, Record<string, number>>;
  missingOutput: number;
  missingCoords: number;
  unclearShift: number;
  missingTone: number;
}

export function summarize(rows: RawRow[], columns: string[]): Summary {
  const fields = ["type", "status", "mode", "band", "district", "network"];
  const uniqueCounts: Record<string, Record<string, number>> = {};
  for (const f of fields) uniqueCounts[f] = {};

  let missingOutput = 0;
  let missingCoords = 0;
  let unclearShift = 0;
  let missingTone = 0;

  for (const r of rows) {
    for (const f of fields) {
      const v = (r[f] ?? "").toString().trim() || "(tom)";
      uniqueCounts[f][v] = (uniqueCounts[f][v] ?? 0) + 1;
    }
    if (parseNumberLoose(r.output) == null) missingOutput++;
    if (parseNumberLoose(r.lat) == null || parseNumberLoose(r.lng) == null) missingCoords++;
    const shiftRaw = (r.tx_shift ?? "").toString().trim();
    if (!shiftRaw || (parseNumberLoose(shiftRaw) == null && shiftRaw.toLowerCase() !== "simplex")) {
      unclearShift++;
    }
    const access = (r.access ?? "").toString();
    if (!extractCtcssQuick(access)) missingTone++;
  }
  return { totalRows: rows.length, columns, uniqueCounts, missingOutput, missingCoords, unclearShift, missingTone };
}

function extractCtcssQuick(access: string): number | null {
  const parts = access.split(/[\s/|,;]+/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    const n = parseNumberLoose(p);
    if (n != null && n !== 1750 && n >= 40 && n <= 300) return n;
  }
  return null;
}
