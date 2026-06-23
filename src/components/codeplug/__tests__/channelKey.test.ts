import { describe, it, expect } from "vitest";
import { channelKey } from "../PreviewTable";
import { makeChannel } from "@/lib/codeplug/__tests__/helpers";

describe("channelKey", () => {
  it("ger olika nycklar för multi-mode-varianter av samma source_row", () => {
    const fm = makeChannel({ mode_effective: "FM", rx_frequency: 145.6 });
    const c4fm = makeChannel({ mode_effective: "C4FM", rx_frequency: 145.6 });
    expect(channelKey(fm)).not.toBe(channelKey(c4fm));
  });

  it("ger olika nycklar för olika RX-frekvenser", () => {
    const a = makeChannel({ rx_frequency: 145.6 });
    const b = makeChannel({ rx_frequency: 145.7 });
    expect(channelKey(a)).not.toBe(channelKey(b));
  });

  it("ger samma nyckel för identiska kanaler", () => {
    expect(channelKey(makeChannel())).toBe(channelKey(makeChannel()));
  });

  it("skiljer kanaler med samma source_id men olika mode_effective (multi-mode-expansion)", () => {
    const fm = makeChannel({ source_id: "SK6RFI", mode_effective: "FM" });
    const c4fm = makeChannel({ source_id: "SK6RFI", mode_effective: "C4FM" });
    expect(channelKey(fm)).not.toBe(channelKey(c4fm));
  });

  it("inkluderar pack_id så att rader från olika channel-packs inte krockar", () => {
    const a = makeChannel({
      source_type: "channel_pack",
      pack_id: "se_marine_vhf_rx",
      source_id: "M16",
    });
    const b = makeChannel({
      source_type: "channel_pack",
      pack_id: "se_pmr446_rx",
      source_id: "M16",
    });
    expect(channelKey(a)).not.toBe(channelKey(b));
  });
});
