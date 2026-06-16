import type { NormalizedChannel, SplitSettings } from "../models";

/**
 * Group channels by district for split-export.
 *
 * Repeater rows (source_type === "sk6ba") are grouped by their `district`
 * digit. Channel-pack rows have no district — they all go into a single
 * "packs" bucket so the user can sideload them separately.
 *
 * Returns an array of { key, label, channels } in deterministic order:
 *   1. numeric districts ascending (0, 1, 2, …)
 *   2. non-numeric / empty districts alphabetically (rare; safety net)
 *   3. "packs" bucket last
 *
 * `key` is a filesystem-safe slug used in filenames; `label` is the
 * display value (currently identical, but kept distinct so future
 * UI can localise).
 */
export interface DistrictBucket {
  key: string;
  label: string;
  channels: NormalizedChannel[];
}

export function groupChannelsForSplit(channels: NormalizedChannel[]): DistrictBucket[] {
  const byDistrict = new Map<string, NormalizedChannel[]>();
  const packs: NormalizedChannel[] = [];

  for (const c of channels) {
    if (c.source_type === "channel_pack") {
      packs.push(c);
      continue;
    }
    // SK6BA / repeater row — bucket by district digit, "0" when missing.
    const d = c.district && c.district.trim() !== "" ? c.district : "0";
    const arr = byDistrict.get(d) ?? [];
    arr.push(c);
    byDistrict.set(d, arr);
  }

  const numeric: DistrictBucket[] = [];
  const nonNumeric: DistrictBucket[] = [];
  for (const [d, list] of byDistrict.entries()) {
    const bucket: DistrictBucket = { key: `distrikt_${d}`, label: d, channels: list };
    if (/^\d+$/.test(d)) numeric.push(bucket);
    else nonNumeric.push(bucket);
  }
  numeric.sort((a, b) => Number(a.label) - Number(b.label));
  nonNumeric.sort((a, b) => a.label.localeCompare(b.label));

  const out = [...numeric, ...nonNumeric];
  if (packs.length > 0) {
    out.push({ key: "packs", label: "packs", channels: packs });
  }
  return out;
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
 *   ("vgc-n76", "distrikt_6", 1, 1) → "vgc-n76_distrikt_6.csv"
 *   ("vgc-n76", "distrikt_6", 2, 1) → "vgc-n76_distrikt_6_part1.csv"
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
     * Hard cap on rows-per-file for the `packs` bucket, applied in any
     * multi-file split mode (`per_district`, `per_district_chunked`).
     * Used by hardware targets like VGC N76 where channel-packs would
     * otherwise overflow the per-group limit. Districts ignore this.
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
    const isPacks = bucket.key === "packs";
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
