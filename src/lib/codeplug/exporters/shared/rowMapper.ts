import Papa from "papaparse";
import type { NormalizedChannel } from "../../models";

/**
 * RowMapper contract — a typed shape that a target uses to map a single
 * `NormalizedChannel` to a flat record of CSV column values. The `columns`
 * array drives header order; the `toRow` function returns the per-column
 * strings.
 *
 * `renderCsv` is a thin wrapper around `Papa.unparse({ fields, data })`
 * so output is byte-identical to targets that use Papa today.
 *
 * Targets with special row injection (APRS slot, padding, leading/trailing
 * empty columns) can still build their final file manually — they take
 * `RowMapper` for the per-channel mapping only and pass the resulting rows
 * to their custom serializer.
 */
export interface RowMapper<TSettings, TCols extends string> {
  columns: readonly TCols[];
  toRow(c: NormalizedChannel, ctx: { index: number; settings: TSettings }): Record<TCols, string>;
}

/**
 * Render channels as a CSV string using a `RowMapper`. Output matches
 * `Papa.unparse({ fields, data })` byte-for-byte.
 */
export function renderCsv<TSettings, TCols extends string>(
  channels: NormalizedChannel[],
  mapper: RowMapper<TSettings, TCols>,
  settings: TSettings,
): string {
  const rows = channels.map((c, index) => mapper.toRow(c, { index, settings }));
  return Papa.unparse({
    fields: [...mapper.columns],
    data: rows.map((r) => mapper.columns.map((col) => r[col])),
  });
}
