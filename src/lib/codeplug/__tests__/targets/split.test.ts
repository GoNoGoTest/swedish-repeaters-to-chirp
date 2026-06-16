import { describe, it, expect } from "vitest";
import { VGC_N76_TARGET, VGC_N76_DEFAULTS } from "@/lib/codeplug/targets/vgc-n76";
import { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "@/lib/codeplug/targets/chirp-generic";
import { groupChannelsForSplit, chunkChannels } from "@/lib/codeplug/targets/split";
import type { SplitSettings } from "@/lib/codeplug/models";
import { makeChannel } from "../helpers";

describe("targets/split groupChannelsForSplit", () => {
  it("groups by district, packs in own bucket, numeric district order", () => {
    const channels = [
      makeChannel({ district: "6", generated_name_final: "A" }),
      makeChannel({ district: "3", generated_name_final: "B" }),
      makeChannel({ district: "6", generated_name_final: "C" }),
      makeChannel({ source_type: "channel_pack", district: "", generated_name_final: "P1" }),
      makeChannel({ district: "0", generated_name_final: "D" }),
    ];
    const buckets = groupChannelsForSplit(channels);
    expect(buckets.map((b) => b.key)).toEqual([
      "distrikt_0",
      "distrikt_3",
      "distrikt_6",
      "packs",
    ]);
    expect(buckets.find((b) => b.key === "distrikt_6")!.channels).toHaveLength(2);
    expect(buckets.find((b) => b.key === "packs")!.channels).toHaveLength(1);
  });

  it("missing district falls back to '0'", () => {
    const buckets = groupChannelsForSplit([
      makeChannel({ district: "", generated_name_final: "X" }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe("distrikt_0");
  });
});

describe("targets/split chunkChannels", () => {
  it("returns single chunk when under size", () => {
    expect(chunkChannels([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
  });
  it("splits at chunk boundaries", () => {
    expect(chunkChannels([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("vgc-n76 exportMany", () => {
  const split: SplitSettings = { mode: "per_district", chunkSize: 32 };

  it("emits one file per district + packs file, deterministic names", () => {
    const channels = [
      makeChannel({ district: "6", generated_name_final: "A", rx_frequency: 145.6 }),
      makeChannel({ district: "3", generated_name_final: "B", rx_frequency: 145.7 }),
      makeChannel({ source_type: "channel_pack", generated_name_final: "P", rx_frequency: 446.0, tx_frequency: 446.0 }),
    ];
    const files = VGC_N76_TARGET.exportMany!(channels, VGC_N76_DEFAULTS, split);
    expect(files.map((f) => f.filename)).toEqual([
      "vgc-n76_distrikt_3.csv",
      "vgc-n76_distrikt_6.csv",
      "vgc-n76_packs.csv",
    ]);
    for (const f of files) expect(f.content.split(/\r?\n/)[0]).toMatch(/^title,tx_freq/);
  });

  it("per_district_chunked respects chunkSize", () => {
    const channels = Array.from({ length: 5 }, (_, i) =>
      makeChannel({ district: "6", generated_name_final: `R${i}`, rx_frequency: 145.0 + i * 0.025 }),
    );
    const files = VGC_N76_TARGET.exportMany!(
      channels,
      VGC_N76_DEFAULTS,
      { mode: "per_district_chunked", chunkSize: 2 },
    );
    expect(files.map((f) => f.filename)).toEqual([
      "vgc-n76_distrikt_6_part1.csv",
      "vgc-n76_distrikt_6_part2.csv",
      "vgc-n76_distrikt_6_part3.csv",
    ]);
  });

  it("split=single returns one file with the standard name", () => {
    const files = VGC_N76_TARGET.exportMany!(
      [makeChannel({ generated_name_final: "X" })],
      VGC_N76_DEFAULTS,
      { mode: "single", chunkSize: 32 },
    );
    expect(files).toHaveLength(1);
    expect(files[0].filename).toBe("vgc-n76.csv");
  });
});

describe("chirp-generic exportMany", () => {
  it("emits per-district files with chirp.csv as base name", () => {
    const channels = [
      makeChannel({ district: "6", generated_name_final: "A", rx_frequency: 145.6 }),
      makeChannel({ district: "3", generated_name_final: "B", rx_frequency: 145.7 }),
    ];
    const files = CHIRP_GENERIC_TARGET.exportMany!(
      channels,
      CHIRP_GENERIC_DEFAULTS,
      { mode: "per_district", chunkSize: 32 },
    );
    expect(files.map((f) => f.filename)).toEqual([
      "chirp_distrikt_3.csv",
      "chirp_distrikt_6.csv",
    ]);
  });
});
