import { z } from "zod";

/**
 * En strukturerad parse-varning. `row` är 1-indexerat CSV-radnummer
 * inklusive header (`null` när Papa/zod inte kan utpeka rad). `column` är
 * kolumnnamnet om vi vet (FieldMismatch / zod-path), annars `null`.
 * Konsumeras av `ParseWarningsPanel` i UI.
 */
export interface ParseWarning {
  row: number | null;
  column: string | null;
  code: string;
  message: string;
  source: "papa" | "schema";
}

/**
 * Konvertera ett PapaParse-fel (`Papa.ParseError`-like) till en
 * `ParseWarning`. Papas `row` är 0-indexerad headerless ⇒ +2 för
 * 1-indexerat radnummer inklusive header.
 */
export function papaErrorToWarning(e: {
  row?: number;
  code?: string;
  message?: string;
  type?: string;
}): ParseWarning {
  return {
    row: typeof e.row === "number" ? e.row + 2 : null,
    column: null,
    code: e.code ?? e.type ?? "PapaError",
    message: e.message ?? "Okänt parse-fel",
    source: "papa",
  };
}

/**
 * Konvertera en zod-issue (från radschemavalidering) till en `ParseWarning`.
 * `rowIdx` är 0-indexerad headerless radindex (samma konvention som
 * `Papa.errors[i].row`).
 */
export function zodIssueToWarning(rowIdx: number, issue: z.ZodIssue): ParseWarning {
  const firstPath = issue.path[0];
  return {
    row: rowIdx + 2,
    column: typeof firstPath === "string" ? firstPath : null,
    code: "schema_invalid",
    message: issue.message,
    source: "schema",
  };
}

/**
 * Minimal zod-schema för SK6BA-rader. Vi accepterar vilken kolumnuppsättning
 * som helst (`.passthrough()`); schemats roll är att garantera att raden
 * faktiskt är ett objekt med strängvärden, så att nedströmskonsumenter
 * (`normalize()`, `summarize()`) kan lita på `String(...)`-cast utan
 * runtime-surprise. Felaktiga rader (icke-objekt, null-värden) ger en
 * struktur-warning men droppas inte — `normalize()` tål tomma värden.
 */
export const sk6baRowSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    band: z.string().optional(),
    mode: z.string().optional(),
    network: z.string().optional(),
    network_id: z.string().optional(),
    district: z.string().optional(),
    call: z.string().optional(),
    city: z.string().optional(),
    channel: z.string().optional(),
    output: z.string().optional(),
    tx_shift: z.string().optional(),
    access: z.string().optional(),
    status: z.string().optional(),
    lat: z.string().optional(),
    lng: z.string().optional(),
    locator: z.string().optional(),
  })
  .passthrough();

export type Sk6baRowSchema = z.infer<typeof sk6baRowSchema>;

/**
 * Channel-pack-radschema. Endast `pack_id`, `source_id` och `rx_frequency`
 * är obligatoriska — matchar `REQUIRED_COLUMNS` i parseChannelPackCsv.
 * `duplex` valideras mot tillåtna värden.
 */
export const packRowSchema = z
  .object({
    pack_id: z.string().min(1),
    source_id: z.string().min(1),
    rx_frequency: z.string().min(1),
    tx_frequency: z.string().optional(),
    duplex: z
      .string()
      .optional()
      .refine(
        (v) =>
          v == null ||
          v === "" ||
          ["+", "-", "split", "off", "simplex"].includes(v.trim().toLowerCase()),
        { message: "Okänt duplex-värde" },
      ),
    offset: z.string().optional(),
    mode: z.string().optional(),
    tstep: z.string().optional(),
    tone: z.string().optional(),
    rtone_freq: z.string().optional(),
    ctone_freq: z.string().optional(),
    dtcs_code: z.string().optional(),
    dtcs_polarity: z.string().optional(),
    skip: z.string().optional(),
    tx_allowed: z.string().optional(),
    rx_only: z.string().optional(),
    enabled_default: z.string().optional(),
    inferred_from_range: z.string().optional(),
    band: z.string().optional(),
    category: z.string().optional(),
    service: z.string().optional(),
    label: z.string().optional(),
    channel: z.string().optional(),
    name_hint: z.string().optional(),
    license_note: z.string().optional(),
    comment: z.string().optional(),
    source: z.string().optional(),
    source_url: z.string().optional(),
    tags: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

export type PackRowSchema = z.infer<typeof packRowSchema>;
