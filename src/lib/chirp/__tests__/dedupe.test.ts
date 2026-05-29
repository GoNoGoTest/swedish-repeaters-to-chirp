import { describe, it, expect } from "vitest";
import { applyFreqDedupe } from "../dedupe";
import { makeChannel } from "./helpers";

describe("applyFreqDedupe", () => {
  it("keep_both keeps everything but tags warnings", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "keep_both");
    expect(r.channels).toHaveLength(2);
    expect(a.warnings.some((w) => w.code === "freq_duplicate")).toBe(true);
    expect(b.warnings.some((w) => w.code === "freq_duplicate")).toBe(true);
  });

  it("drop_pack removes pack row when sk6ba present", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "drop_pack");
    expect(r.channels).toEqual([a]);
    expect(r.dropped).toEqual([b]);
  });

  it("drop_sk6ba removes sk6ba row when pack present", () => {
    const a = makeChannel({ rx_frequency: 145.6, source_type: "sk6ba" });
    const b = makeChannel({ rx_frequency: 145.6, source_type: "channel_pack" });
    const r = applyFreqDedupe([a, b], "drop_sk6ba");
    expect(r.channels).toEqual([b]);
  });

  it("stop sets stopped flag without removing", () => {
    const a = makeChannel({ rx_frequency: 145.6 });
    const b = makeChannel({ rx_frequency: 145.6 });
    const r = applyFreqDedupe([a, b], "stop");
    expect(r.stopped).toBe(true);
    expect(r.channels).toHaveLength(2);
  });

  it("no warnings when frequencies differ", () => {
    const a = makeChannel({ rx_frequency: 145.6 });
    const b = makeChannel({ rx_frequency: 145.7 });
    applyFreqDedupe([a, b], "keep_both");
    expect(a.warnings).toEqual([]);
  });
});
