/**
 * Canonical mode catalog used by the filter UI and the per-mode expansion
 * step in the pipeline.
 *
 * SK6BA's `mode` column holds free-text strings like "FM", "C4FM",
 * "FM / C4FM", "DMR / D-Star / C4FM". We normalise those to a stable
 * vocabulary so:
 *   - the filter UI can show a fixed set of toggles
 *   - the pipeline can expand a multi-mode row into one channel per mode
 *   - exporters can decide what to do with each mode (FM, C4FM, …)
 */

export const KNOWN_MODES = [
  "FM",
  "C4FM",
  "D-Star",
  "DMR",
  "DMRplus",
  "P25",
  "Tetra",
  "CW",
] as const;

export type KnownMode = (typeof KNOWN_MODES)[number];

/**
 * Alias → canonical name. Keys are upper-cased before lookup so the table
 * itself only needs the upper form. Add liberally as new SK6BA / target
 * idioms appear.
 */
const MODE_ALIASES: Record<string, KnownMode> = {
  FM: "FM",
  NFM: "FM",
  WFM: "FM",
  C4FM: "C4FM",
  YSF: "C4FM",
  DN: "C4FM", // RT Systems Yaesu CSV calls C4FM "DN"
  FUSION: "C4FM",
  "SYSTEM FUSION": "C4FM",
  "D-STAR": "D-Star",
  DSTAR: "D-Star",
  "D STAR": "D-Star",
  DV: "D-Star",
  DMR: "DMR",
  DMRPLUS: "DMRplus",
  "DMR+": "DMRplus",
  P25: "P25",
  TETRA: "Tetra",
  CW: "CW",
};

/**
 * Parse a free-text mode string into a deduped list of canonical modes,
 * in the order they appear in the source.
 *
 *  "FM / C4FM"             → ["FM","C4FM"]
 *  "DMR / D-Star / C4FM"   → ["DMR","D-Star","C4FM"]
 *  "  FM/DMR ,  C4FM "     → ["FM","DMR","C4FM"]
 *  "PI4 - CW"              → ["CW"]
 *  ""                      → []
 *  "Tetra"                 → ["Tetra"]
 *  "frobnicate"            → []  (unknown tokens are dropped)
 */
export function parseModes(raw: string | undefined | null): KnownMode[] {
  if (!raw) return [];
  const tokens = String(raw)
    .split(/[\/,;|]/) // separators between modes
    .flatMap((p) => p.split(/\s+/)) // and whitespace within a chunk
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<KnownMode>();
  const out: KnownMode[] = [];
  for (const t of tokens) {
    const canonical = MODE_ALIASES[t.toUpperCase()];
    if (!canonical) continue;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/** True if `mode` is one of the canonical KNOWN_MODES values. */
export function isKnownMode(mode: string): mode is KnownMode {
  return (KNOWN_MODES as readonly string[]).includes(mode);
}
