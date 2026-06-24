import type { KnownMode } from "../../modes";
import type { ChannelMode, ChannelPackMeta } from "../../models";

/**
 * Per-target mapping from canonical signal mode (`KnownMode`) to whatever
 * token the target's CSV / programming-app expects ("DN", "DV", "DMR", "FM",
 * "AM", "WFM"…). `null` means "this target does not support this mode" —
 * the caller decides what to do (fall back to analog, drop the channel,
 * warn, …).
 *
 * Use `Partial<>` so a target only declares the modes it knows about.
 * Modes not present in the map resolve to the caller's `fallback`.
 */
export type ModeMap = Partial<Record<KnownMode, string | null>>;

/**
 * Aliases that may appear in channel-pack `mode_pack` columns or in raw
 * `mode_effective` strings that haven't gone through `parseModes()`.
 * Maps lowercase alias → KnownMode. Lets targets accept synonyms like
 * "DSTAR", "DV", "DMR+", "DMRPLUS" without each target redoing the table.
 */
const MODE_ALIASES: Record<string, KnownMode> = {
  fm: "FM",
  nfm: "FM",
  wfm: "FM",
  c4fm: "C4FM",
  dn: "C4FM",
  fusion: "C4FM",
  ysf: "C4FM",
  "d-star": "D-Star",
  dstar: "D-Star",
  dv: "D-Star",
  dmr: "DMR",
  "dmr+": "DMRplus",
  dmrplus: "DMRplus",
  p25: "P25",
  tetra: "Tetra",
  cw: "CW",
};

/** Normalise a raw mode string to a `KnownMode`, or null if unknown. */
export function canonicalizeMode(raw: string): KnownMode | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return MODE_ALIASES[key] ?? null;
}

/**
 * Resolve the target-specific mode token for a channel.
 *
 * Reads `mode_pack` first for channel-pack rows (so pack mode like
 * `"C4FM"` / `"DMR+"` / `"DV"` is honoured), then `mode_effective`.
 *
 * Returns:
 *  - the mapped token when the canonical mode is in the map (and not `null`)
 *  - `null` when the canonical mode is explicitly in the map as `null`
 *    ("supported but no token; let caller fall back")
 *  - `fallback` for unknown modes (or when both fields are empty)
 */
export function resolveTargetMode(
  c: ChannelMode & Pick<ChannelPackMeta, "mode_pack"> & { source_type: string },
  map: ModeMap,
  fallback: string,
): string | null {
  const sourceMode =
    c.source_type === "channel_pack" && c.mode_pack ? c.mode_pack : c.mode_effective;
  const canon = canonicalizeMode(sourceMode);
  if (canon == null) return fallback;
  const mapped = map[canon];
  if (mapped === undefined) return fallback;
  return mapped; // string or null (null = caller fallback)
}
