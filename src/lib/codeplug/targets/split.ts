import type { NormalizedChannel, SplitSettings } from "../models";

/**
 * Group channels by region for split-export.
 *
 * Repeater rows (source_type === "sk6ba") are grouped by their `region`
 * (country + districtLabel) so Nordic / foreign rows each get their own
 * file (SE/SM6, NO/LA, DK/OZ, FI/OH6, AX/OH0, IS/TF, …) instead of being
 * lumped under a raw district digit. Rows with country "unknown" fall
 * back to an "unknown" bucket (optionally suffixed with the raw district
 * code). Channel-pack rows have no region — they all go into separate
 * "packs" buckets so the user can sideload them separately.
 *
 * Returns an array of { key, label, channels } in deterministic order:
 *   1. region buckets sorted by region.sortKey (SE/SM* first, then other
 *      Nordic countries, then "unknown")
 *   2. pack buckets, one per pack_id (further split by band when a pack
 *      spans multiple bands)
 *
 * `key` is a filesystem-safe slug used in filenames (e.g. "se_sm6",
 * "no_la", "dk_oz", "fi_oh6"); `label` is the display value.
 */
export interface DistrictBucket {
  key: string;
  label: string;
  channels: NormalizedChannel[];
  /** True for channel-pack buckets — opt-in to packsChunkSize / packsSplitByBand. */
  isPack?: boolean;
}

/**
 * Derive a short, human-readable name from a pack_id for use in filenames.
 * Examples:
 *   "se_marine_vhf_rx"   → "marine_vhf"
 *   "se_amateur_2m_70cm" → "amateur_2m_70cm"
 *   ""                   → "packs" (fallback for legacy/empty pack_id)
 */
function packShortName(packId: string): string {
  const trimmed = packId.trim();
  if (!trimmed) return "packs";
  return trimmed.replace(/^se_/, "").replace(/_rx$/, "");
}

export function groupChannelsForSplit(channels: NormalizedChannel[]): DistrictBucket[] {
  // Repeater rows are bucketed by region (country + districtLabel) so that
  // LA, OZ, OH6 etc. each get their own file with a region-aware slug instead
  // of being lumped under raw district strings.
  const byRegion = new Map<
    string,
    { sortKey: string; key: string; label: string; channels: NormalizedChannel[] }
  >();
  const byPack = new Map<string, NormalizedChannel[]>();

  for (const c of channels) {
    if (c.source_type === "channel_pack") {
      const pid = c.pack_id ?? "";
      const arr = byPack.get(pid) ?? [];
      arr.push(c);
      byPack.set(pid, arr);
      continue;
    }
    const region = c.region;
    let key: string;
    let label: string;
    if (region.countryCode === "unknown") {
      key = region.districtCode
        ? `unknown_${region.districtCode.toLowerCase()}`
        : "unknown";
      label = region.districtCode || "Okänt";
    } else {
      key = `${region.countryCode.toLowerCase()}_${region.districtLabel.toLowerCase()}`;
      label = region.districtLabel;
    }
    const bucket = byRegion.get(key) ?? { sortKey: region.sortKey, key, label, channels: [] };
    bucket.channels.push(c);
    byRegion.set(key, bucket);
  }

  const regionBuckets: DistrictBucket[] = Array.from(byRegion.values())
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .map(({ key, label, channels }) => ({ key, label, channels }));

  // One bucket per pack_id. If a pack spans multiple bands (e.g. amateur 2m+70cm),
  // split it further into one bucket per band.
  const packBuckets: DistrictBucket[] = [];
  const packIds = Array.from(byPack.keys()).sort();
  for (const pid of packIds) {
    const list = byPack.get(pid)!;
    const short = packShortName(pid);
    const bands = new Set(list.map((c) => (c.band ?? "").trim()).filter(Boolean));
    if (bands.size > 1) {
      const byBand = new Map<string, NormalizedChannel[]>();
      for (const c of list) {
        const b = (c.band ?? "").trim() || "okant";
        const arr = byBand.get(b) ?? [];
        arr.push(c);
        byBand.set(b, arr);
      }
      const sortedBands = Array.from(byBand.keys()).sort();
      for (const b of sortedBands) {
        packBuckets.push({
          key: `${short}_${b}`,
          label: `${short} ${b}`,
          channels: byBand.get(b)!,
          isPack: true,
        });
      }
    } else {
      packBuckets.push({ key: short, label: short, channels: list, isPack: true });
    }
  }

  return [...regionBuckets, ...packBuckets];
}

/**
 * Chunk a list of channels by `chunkSize`. Returns at least one chunk,
 * even if the input is empty (so callers can still emit a file).
 */
export function chunkChannels<T>(list: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0 || list.length <= chunkSize) return [list];
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

/**
 * Build a filename for a split chunk. Examples:
 *   ("chirp",   "se_sm6", 1, 0) → "chirp_se_sm6.csv"
 *   ("chirp",   "no_la",  1, 0) → "chirp_no_la.csv"
 *   ("vgc-n76", "dk_oz",  2, 0) → "vgc-n76_dk_oz_part1.csv"
 *   ("vgc-n76", "fi_oh6", 2, 1) → "vgc-n76_fi_oh6_part2.csv"
 */
export function chunkFilename(
  base: string,
  bucketKey: string,
  totalChunks: number,
  chunkIndex: number,
  extension: string,
): string {
  const suffix = totalChunks > 1 ? `_part${chunkIndex + 1}` : "";
  return `${base}_${bucketKey}${suffix}.${extension}`;
}

/**
 * Generic helper for targets to implement `exportMany`. Calls
 * `renderChunk` once per file, lets the target choose how to render
 * each chunk's bytes.
 */
export function buildSplitFiles(
  channels: NormalizedChannel[],
  split: SplitSettings,
  opts: {
    filenameBase: string;
    extension: string;
    renderChunk: (chunk: NormalizedChannel[]) => string;
    /**
     * Hard cap on rows-per-file for `packs` buckets, applied in any
     * multi-file split mode (`per_district`, `per_district_chunked`).
     * Used by hardware targets like VGC N76 where channel-packs would
     * otherwise overflow the per-group limit. Region buckets ignore this.
     */
    packsChunkSize?: number;
  },
): { filename: string; content: string }[] {
  if (split.mode === "single") {
    return [{
      filename: `${opts.filenameBase}.${opts.extension}`,
      content: opts.renderChunk(channels),
    }];
  }

  const buckets = groupChannelsForSplit(channels);
  const districtChunkSize = split.mode === "per_district_chunked" ? Math.max(1, split.chunkSize) : Infinity;
  const out: { filename: string; content: string }[] = [];
  for (const bucket of buckets) {
    const isPacks = bucket.isPack === true;
    const packsCap = isPacks && opts.packsChunkSize && opts.packsChunkSize > 0
      ? opts.packsChunkSize
      : Infinity;
    const effective = Math.min(districtChunkSize, packsCap);
    const chunks = Number.isFinite(effective)
      ? chunkChannels(bucket.channels, effective)
      : [bucket.channels];
    chunks.forEach((chunk, idx) => {
      out.push({
        filename: chunkFilename(opts.filenameBase, bucket.key, chunks.length, idx, opts.extension),
        content: opts.renderChunk(chunk),
      });
    });
  }
  return out;
}
