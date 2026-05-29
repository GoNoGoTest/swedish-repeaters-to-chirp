import type { NormalizedChannel, RawRow, Settings, Warning } from "./models";
import { parseNumberLoose } from "./importers/sk6ba";
import { parseAccess } from "./tones";
import { parseShift } from "./frequency";
import { applyFilters } from "./filters";
import { buildName, resolveCollisions } from "./naming";
import { sortChannels } from "./sorting";

export function normalize(rows: RawRow[]): NormalizedChannel[] {
  return rows.map((r, idx) => {
    const warnings: Warning[] = [];
    const output = parseNumberLoose(r.output);
    if (r.output && parseNumberLoose(r.output) == null) {
      warnings.push({ code: "invalid_output", message: `Ogiltig output: ${r.output}` });
    }
    if (output == null) warnings.push({ code: "missing_output", message: "Saknad outputfrekvens" });

    const shift = parseShift(r.tx_shift);
    if (shift.unclear) warnings.push({ code: "unclear_shift", message: `Oklar tx_shift: ${r.tx_shift}` });

    const access = parseAccess(r.access);
    if (!access.ctcss && !access.uses1750 && r.access) {
      warnings.push({ code: "missing_access_tone", message: `Otydlig access: ${r.access}` });
    }

    const lat = parseNumberLoose(r.lat);
    const lng = parseNumberLoose(r.lng);
    if (lat == null || lng == null) {
      warnings.push({ code: "missing_coords", message: "Saknade koordinater" });
    }

    const modeRaw = (r.mode ?? "").toString();
    const district = (r.district ?? "").toString().trim();
    const type = (r.type ?? "").toString().trim();
    const network = (r.network ?? "").toString().trim();
    const city = (r.city ?? "").toString().trim();
    const call = (r.call ?? "").toString().trim();
    const channel = (r.channel ?? "").toString().trim();
    const band = (r.band ?? "").toString().trim();
    const locator = (r.locator ?? "").toString().trim();

    const commentParts = [
      call, channel, city,
      district ? `D${district}` : "",
      type, network,
      r.access ? `access=${r.access}` : "",
      locator ? `loc=${locator}` : "",
    ].filter(Boolean);

    return {
      source_row: idx + 2,
      source_id: (r.id ?? "").toString(),
      type, status: (r.status ?? "").toString().trim(),
      mode_raw: modeRaw,
      is_analog_fm: /\bFM\b/i.test(modeRaw),
      band, district, city, call, channel, network,
      network_id: (r.network_id ?? "").toString(),
      access_raw: (r.access ?? "").toString(),
      rx_frequency: output,
      tx_shift_raw: (r.tx_shift ?? "").toString(),
      tx_shift: shift.shift,
      shift_unclear: shift.unclear,
      duplex: shift.duplex,
      offset: shift.offset,
      ctcss_tx: access.ctcss,
      uses_1750: access.uses1750,
      lat, lng, locator,
      comment: commentParts.join(" | "),
      generated_name_full: "",
      generated_name_final: "",
      collided: false,
      warnings,
    };
  });
}

export interface PipelineResult {
  channels: NormalizedChannel[];
  filteredOut: number;
  unresolvedCollisions: number;
  totalInput: number;
}

export function runPipeline(rows: RawRow[], settings: Settings): PipelineResult {
  const totalInput = rows.length;
  const normalized = normalize(rows);
  // Drop rows with no output (cannot be exported)
  const exportable = normalized.filter((c) => c.rx_frequency != null);
  const filtered = applyFilters(exportable, settings.filter);

  for (const ch of filtered) {
    const { full, clipped } = buildName(ch, settings.naming);
    ch.generated_name_full = full;
    ch.generated_name_final = clipped || "NONAME";
    if (!clipped) ch.warnings.push({ code: "empty_name", message: "Tomt kanalnamn" });
  }

  const sorted = sortChannels(filtered, settings.sort);
  const { unresolved } = resolveCollisions(sorted, settings.naming);
  for (const ch of sorted) {
    if (ch.collided) ch.warnings.push({ code: "name_collision", message: "Namnkollision" });
  }

  return {
    channels: sorted,
    filteredOut: totalInput - sorted.length,
    unresolvedCollisions: unresolved,
    totalInput,
  };
}
