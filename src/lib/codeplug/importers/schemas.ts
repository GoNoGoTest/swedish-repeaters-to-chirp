import { z } from "zod";

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
 * `duplex` valideras mot tillåtna värden (Papa ger oss strängar; vi
 * accepterar både "" och de fyra giltiga + "simplex").
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

/**
 * Konvertera ett PapaParse-fel till en kort svensk meddelandesträng,
 * lämplig att visa i en info-banner. `row` är 0-indexerad headerless;
 * vi adderar +2 för 1-indexerat CSV-radnummer inklusive header.
 */
export function formatPapaError(e: {
  row?: number;
  code?: string;
  message?: string;
  type?: string;
}): string {
  const rowLabel = typeof e.row === "number" ? `Rad ${e.row + 2}: ` : "";
  const code = e.code ? `${e.code} — ` : "";
  return `${rowLabel}${code}${e.message ?? "Okänt parse-fel"}`;
}
