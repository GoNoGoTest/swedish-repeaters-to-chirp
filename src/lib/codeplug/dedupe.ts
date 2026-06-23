import type { FreqDupePolicy, NormalizedChannel } from "./models";

export interface DedupeResult {
  channels: NormalizedChannel[];
  stopped: boolean;
  dropped: NormalizedChannel[];
}

/**
 * Detect frequency duplicates between SK6BA-imported rows and channel-pack rows
 * (and pack-vs-pack). Frequencies are compared by rounded RX (5 decimals).
 *
 * Pure: never mutates the input array or any input channel object. Rows that
 * need a `freq_duplicate` warning are replaced with a shallow clone whose
 * `warnings` is a fresh array. Channel-pack rows may come from cache, so
 * mutation would let warnings accumulate across renders.
 */
export function applyFreqDedupe(
  channels: NormalizedChannel[],
  policy: FreqDupePolicy,
): DedupeResult {
  const groups = new Map<string, NormalizedChannel[]>();
  for (const c of channels) {
    if (c.rx_frequency == null) continue;
    const key = c.rx_frequency.toFixed(5);
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  const dropIds = new Set<NormalizedChannel>();
  const warnFor = new Map<NormalizedChannel, string>();
  let stopped = false;

  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    const hasSk6ba = arr.some((c) => c.source_type === "sk6ba");
    const hasPack = arr.some((c) => c.source_type === "channel_pack");
    const packCount = arr.filter((c) => c.source_type === "channel_pack").length;
    // Repeaters legitimately share RX frequencies on amateur bands — only warn
    // when a channel-pack row collides (pack-vs-sk6ba or pack-vs-pack).
    const shouldWarn = (hasSk6ba && hasPack) || packCount >= 2;
    if (shouldWarn) {
      const message = `Frekvensdubblett: ${arr.length} rader på ${arr[0].rx_frequency?.toFixed(5)} MHz`;
      for (const ch of arr) {
        // SK6BA repeater rows are authoritative — never warn on them.
        if (ch.source_type === "sk6ba") continue;
        // Idempotent: skip rows that already carry a freq_duplicate warning.
        if (ch.warnings.some((w) => w.code === "freq_duplicate")) continue;
        warnFor.set(ch, message);
      }
    }

    if (policy === "keep_both") continue;
    if (policy === "stop" && shouldWarn) {
      stopped = true;
      continue;
    }
    if (policy === "drop_pack" && hasSk6ba && hasPack) {
      for (const c of arr) if (c.source_type === "channel_pack") dropIds.add(c);
    } else if (policy === "drop_sk6ba" && hasSk6ba && hasPack) {
      for (const c of arr) if (c.source_type === "sk6ba") dropIds.add(c);
    }
  }

  const dropped: NormalizedChannel[] = [];
  const kept: NormalizedChannel[] = [];
  for (const c of channels) {
    if (dropIds.has(c)) {
      dropped.push(c);
      continue;
    }
    const msg = warnFor.get(c);
    if (msg) {
      kept.push({
        ...c,
        warnings: [...c.warnings, { code: "freq_duplicate", message: msg }],
      });
    } else {
      kept.push(c);
    }
  }
  return { channels: kept, stopped, dropped };
}
