import { describe, it, expect } from "vitest";
import { applyFreqDedupe } from "../dedupe";
import { makeChannel } from "./helpers";

describe("applyFreqDedupe", () => {
  it("keep_both keeps everything but tags pack-rad warnings utan att mutera input", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const origA = a.warnings;
    const origB = b.warnings;
    const r = applyFreqDedupe([a, b], "keep_both");
    expect(r.channels).toHaveLength(2);
    // Inputobjekten orörda — samma warnings-referens, fortfarande tom.
    expect(a.warnings).toBe(origA);
    expect(b.warnings).toBe(origB);
    expect(a.warnings).toHaveLength(0);
    expect(b.warnings).toHaveLength(0);
    // Resultatet: pack-raden flaggad, sk6ba-raden inte.
    const resA = r.channels.find((c) => c.source_type === "sk6ba")!;
    const resB = r.channels.find((c) => c.source_type === "channel_pack")!;
    expect(resA.warnings.some((w) => w.code === "freq_duplicate")).toBe(false);
    expect(resB.warnings.some((w) => w.code === "freq_duplicate")).toBe(true);
  });

  it("är idempotent — varningar ackumuleras inte vid upprepad körning", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    applyFreqDedupe([a, b], "keep_both");
    const r2 = applyFreqDedupe([a, b], "keep_both");
    expect(a.warnings).toHaveLength(0);
    expect(b.warnings).toHaveLength(0);
    const resB = r2.channels.find((c) => c.source_type === "channel_pack")!;
    expect(resB.warnings.filter((w) => w.code === "freq_duplicate")).toHaveLength(1);
  });

  it("drop_pack removes pack row when sk6ba present och dropped pekar på originalet", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "drop_pack");
    expect(r.channels).toEqual([a]);
    expect(r.dropped).toEqual([b]);
    expect(r.dropped[0]).toBe(b);
  });

  it("drop_sk6ba removes sk6ba row when pack present", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "drop_sk6ba");
    expect(r.channels.map((c) => c.source_type)).toEqual(["channel_pack"]);
  });

  it("stop sets stopped flag without removing (pack vs sk6ba)", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "stop");
    expect(r.stopped).toBe(true);
    expect(r.channels).toHaveLength(2);
  });

  it("no warnings when frequencies differ", () => {
    const a = makeChannel({ rx_frequency: 145.6 });
    const b = makeChannel({ rx_frequency: 145.7 });
    const r = applyFreqDedupe([a, b], "keep_both");
    expect(r.channels[0].warnings).toEqual([]);
    expect(r.channels[1].warnings).toEqual([]);
  });

  it("sk6ba-vs-sk6ba does not warn (repeaters share frequencies legitimately)", () => {
    const a = makeChannel({ rx_frequency: 145.725, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.725, source_type: "sk6ba" });
    const r = applyFreqDedupe([a, b], "keep_both");
    expect(r.channels).toHaveLength(2);
    expect(r.channels[0].warnings).toEqual([]);
    expect(r.channels[1].warnings).toEqual([]);
  });

  it("pack-vs-pack does warn (på resultatkanalerna, ej input)", () => {
    const a = makeChannel({ rx_frequency: 446.00625, source_type: "channel_pack" });
    const b = makeChannel({ rx_frequency: 446.00625, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "keep_both");
    expect(a.warnings).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(r.channels[0].warnings.some((w) => w.code === "freq_duplicate")).toBe(true);
    expect(r.channels[1].warnings.some((w) => w.code === "freq_duplicate")).toBe(true);
  });
});
