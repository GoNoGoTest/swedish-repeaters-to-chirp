import { describe, it, expect } from "vitest";
import { VGC_N76_TARGET, VGC_N76_DEFAULTS } from "@/lib/codeplug/targets/vgc-n76";
import { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "@/lib/codeplug/targets/chirp-generic";
import { groupChannelsForSplit, chunkChannels } from "@/lib/codeplug/targets/split";
import type { SplitSettings } from "@/lib/codeplug/models";
import { makeChannel } from "../helpers";

describe("targets/split groupChannelsForSplit", () => {
  it("groups by region, packs in own bucket, COUNTRY_SORT_ORDER then label", () => {
    const channels = [
      makeChannel({ district: "6", generated_name_final: "A" }),
      makeChannel({ district: "3", generated_name_final: "B" }),
      makeChannel({ district: "6", generated_name_final: "C" }),
      makeChannel({ source_type: "channel_pack", district: "", generated_name_final: "P1" }),
      makeChannel({ district: "0", generated_name_final: "D" }),
    ];
    const buckets = groupChannelsForSplit(channels);
    expect(buckets.map((b) => b.key)).toEqual([
      "se_sm0",
      "se_sm3",
      "se_sm6",
      "packs",
    ]);
    expect(buckets.find((b) => b.key === "se_sm6")!.channels).toHaveLength(2);
    expect(buckets.find((b) => b.key === "packs")!.channels).toHaveLength(1);
  });

  it("missing district falls back to 'unknown' bucket", () => {
    const buckets = groupChannelsForSplit([
      makeChannel({ district: "", generated_name_final: "X" }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe("unknown");
  });

  it("Nordic prefixes get own region-slugged buckets in country order", () => {
    const channels = [
      makeChannel({ district: "OX", generated_name_final: "GL1" }),
      makeChannel({ district: "OH0", generated_name_final: "AX1" }),
      makeChannel({ district: "LA", generated_name_final: "NO1" }),
      makeChannel({ district: "6", generated_name_final: "SE1" }),
      makeChannel({ district: "OZ", generated_name_final: "DK1" }),
      makeChannel({ district: "OH6", generated_name_final: "FI1" }),
      makeChannel({ district: "TF", generated_name_final: "IS1" }),
      makeChannel({ district: "JW", generated_name_final: "SJ1" }),
      makeChannel({ district: "OY", generated_name_final: "FO1" }),
    ];
    const buckets = groupChannelsForSplit(channels);
    expect(buckets.map((b) => b.key)).toEqual([
      "se_sm6",
      "no_la",
      "dk_oz",
      "fi_oh6",
      "ax_oh0",
      "is_tf",
      "sj_jw",
      "fo_oy",
      "gl_ox",
    ]);
  });

  it("one bucket per pack_id with short descriptive name", () => {
    const buckets = groupChannelsForSplit([
      makeChannel({ source_type: "channel_pack", pack_id: "se_marine_vhf_rx", band: "vhf", generated_name_final: "M1" }),
      makeChannel({ source_type: "channel_pack", pack_id: "se_marine_vhf_rx", band: "vhf", generated_name_final: "M2" }),
      makeChannel({ source_type: "channel_pack", pack_id: "se_pmr446_rx", band: "uhf", generated_name_final: "P1" }),
    ]);
    expect(buckets.map((b) => b.key)).toEqual(["marine_vhf", "pmr446"]);
    expect(buckets[0].channels).toHaveLength(2);
    expect(buckets.every((b) => b.isPack)).toBe(true);
  });

  it("splits amateur multi-band pack into one bucket per band", () => {
    const buckets = groupChannelsForSplit([
      makeChannel({ source_type: "channel_pack", pack_id: "se_amateur_2m_70cm", band: "2m", generated_name_final: "A1" }),
      makeChannel({ source_type: "channel_pack", pack_id: "se_amateur_2m_70cm", band: "70cm", generated_name_final: "A2" }),
      makeChannel({ source_type: "channel_pack", pack_id: "se_amateur_2m_70cm", band: "2m", generated_name_final: "A3" }),
    ]);
    expect(buckets.map((b) => b.key)).toEqual(["amateur_2m_70cm_2m", "amateur_2m_70cm_70cm"]);
    expect(buckets[0].channels).toHaveLength(2);
    expect(buckets[1].channels).toHaveLength(1);
  });

  it("empty pack_id falls back to 'packs' bucket", () => {
    const buckets = groupChannelsForSplit([
      makeChannel({ source_type: "channel_pack", generated_name_final: "X" }),
    ]);
    expect(buckets[0].key).toBe("packs");
    expect(buckets[0].isPack).toBe(true);
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
      "vgc-n76_se_sm3.csv",
      "vgc-n76_se_sm6.csv",
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
      "vgc-n76_se_sm6_part1.csv",
      "vgc-n76_se_sm6_part2.csv",
      "vgc-n76_se_sm6_part3.csv",
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

  it("per_district chunks packs at VGC group limit (32) even if districts unchunked", () => {
    const repeaters = [
      makeChannel({ district: "6", generated_name_final: "R", rx_frequency: 145.6 }),
    ];
    const packs = Array.from({ length: 50 }, (_, i) =>
      makeChannel({
        source_type: "channel_pack",
        generated_name_final: `P${i}`,
        rx_frequency: 446.0,
        tx_frequency: 446.0,
      }),
    );
    const files = VGC_N76_TARGET.exportMany!(
      [...repeaters, ...packs],
      VGC_N76_DEFAULTS,
      { mode: "per_district", chunkSize: 32 },
    );
    expect(files.map((f) => f.filename)).toEqual([
      "vgc-n76_se_sm6.csv",
      "vgc-n76_packs_part1.csv",
      "vgc-n76_packs_part2.csv",
    ]);
    const rows = (csv: string) => csv.trim().split(/\r?\n/).length - 1;
    expect(rows(files[1].content)).toBe(32);
    expect(rows(files[2].content)).toBe(18);
  });

  it("per_district_chunked uses min(user chunkSize, packs cap)", () => {
    const packs = Array.from({ length: 80 }, (_, i) =>
      makeChannel({
        source_type: "channel_pack",
        generated_name_final: `P${i}`,
        rx_frequency: 446.0,
        tx_frequency: 446.0,
      }),
    );
    const files = VGC_N76_TARGET.exportMany!(
      packs,
      VGC_N76_DEFAULTS,
      { mode: "per_district_chunked", chunkSize: 50 },
    );
    expect(files.map((f) => f.filename)).toEqual([
      "vgc-n76_packs_part1.csv",
      "vgc-n76_packs_part2.csv",
      "vgc-n76_packs_part3.csv",
    ]);
    const rows = (csv: string) => csv.trim().split(/\r?\n/).length - 1;
    expect([rows(files[0].content), rows(files[1].content), rows(files[2].content)]).toEqual([32, 32, 16]);
  });

  it("per_district_chunked with user chunkSize < cap keeps user value", () => {
    const packs = Array.from({ length: 25 }, (_, i) =>
      makeChannel({
        source_type: "channel_pack",
        generated_name_final: `P${i}`,
        rx_frequency: 446.0,
        tx_frequency: 446.0,
      }),
    );
    const files = VGC_N76_TARGET.exportMany!(
      packs,
      VGC_N76_DEFAULTS,
      { mode: "per_district_chunked", chunkSize: 10 },
    );
    const rows = (csv: string) => csv.trim().split(/\r?\n/).length - 1;
    expect(files).toHaveLength(3);
    expect([rows(files[0].content), rows(files[1].content), rows(files[2].content)]).toEqual([10, 10, 5]);
  });
});

describe("chirp-generic packs not capped", () => {
  it("per_district keeps all 100 packs in a single packs file", () => {
    const packs = Array.from({ length: 100 }, (_, i) =>
      makeChannel({
        source_type: "channel_pack",
        generated_name_final: `P${i}`,
        rx_frequency: 446.0,
        tx_frequency: 446.0,
      }),
    );
    const files = CHIRP_GENERIC_TARGET.exportMany!(
      packs,
      CHIRP_GENERIC_DEFAULTS,
      { mode: "per_district", chunkSize: 32 },
    );
    expect(files.map((f) => f.filename)).toEqual(["chirp_packs.csv"]);
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
      "chirp_se_sm3.csv",
      "chirp_se_sm6.csv",
    ]);
  });
});
