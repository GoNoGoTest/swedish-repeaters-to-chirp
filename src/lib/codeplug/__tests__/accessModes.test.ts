import { describe, it, expect } from "vitest";
import {
  classifyMode,
  classifyChannel,
  isAnalogToneMode,
  applyModeAccessSubset,
} from "../accessModes";
import { makeChannel } from "./helpers";

describe("classifyMode", () => {
  it("analog for FM/NFM/WFM/empty", () => {
    for (const m of ["FM", "NFM", "WFM", "", "fm", "nfm"]) {
      expect(classifyMode(m)).toBe("analog");
    }
  });
  it("none for CW", () => {
    expect(classifyMode("CW")).toBe("none");
  });
  it("dmr synonyms", () => {
    expect(classifyMode("DMR")).toBe("dmr");
    expect(classifyMode("DMRPLUS")).toBe("dmr");
    expect(classifyMode("DMR+")).toBe("dmr");
  });
  it("c4fm synonyms", () => {
    expect(classifyMode("C4FM")).toBe("c4fm");
    expect(classifyMode("DN")).toBe("c4fm");
  });
  it("d-star synonyms", () => {
    expect(classifyMode("D-Star")).toBe("dstar");
    expect(classifyMode("DSTAR")).toBe("dstar");
    expect(classifyMode("DV")).toBe("dstar");
  });
  it("p25 and tetra", () => {
    expect(classifyMode("P25")).toBe("p25");
    expect(classifyMode("Tetra")).toBe("tetra");
  });
  it("trims whitespace", () => {
    expect(classifyMode(" DMR ")).toBe("dmr");
    expect(classifyMode("\tFM\n")).toBe("analog");
  });
});

describe("isAnalogToneMode", () => {
  it("true for FM sk6ba, false for DMR sk6ba", () => {
    expect(isAnalogToneMode(makeChannel({ mode_effective: "FM" }))).toBe(true);
    expect(isAnalogToneMode(makeChannel({ mode_effective: "DMR" }))).toBe(false);
  });
  it("pack uses mode_pack", () => {
    expect(
      isAnalogToneMode(
        makeChannel({ source_type: "channel_pack", mode_pack: "DV", mode_effective: "FM" }),
      ),
    ).toBe(false);
  });
});

describe("classifyChannel + applyModeAccessSubset", () => {
  it("DMR clears analog tone, keeps DMR fields", () => {
    const c = makeChannel({
      mode_effective: "DMR",
      ctcss_tx: 123.0,
      dmr_color_code: 1,
      access_raw: "123.0 / CC 1",
    });
    const r = applyModeAccessSubset(c);
    expect(r.ctcss_tx).toBeNull();
    expect(r.dmr_color_code).toBe(1);
    expect(r.digital_access_raw).toBe("123.0 / CC 1");
  });
  it("FM keeps analog, clears digital fields", () => {
    const c = makeChannel({
      mode_effective: "FM",
      ctcss_tx: 88.5,
      dmr_color_code: 1,
    });
    const r = applyModeAccessSubset(c);
    expect(r.ctcss_tx).toBe(88.5);
    expect(r.dmr_color_code).toBeNull();
    expect(r.digital_access_raw).toBe("");
  });
  it("CW (none) clears both", () => {
    const c = makeChannel({ mode_effective: "CW", ctcss_tx: 88.5, dmr_color_code: 1 });
    const r = applyModeAccessSubset(c);
    expect(r.ctcss_tx).toBeNull();
    expect(r.dmr_color_code).toBeNull();
    expect(r.digital_access_raw).toBe("");
  });
  it("does not mutate input", () => {
    const c = makeChannel({ mode_effective: "DMR", ctcss_tx: 100, dmr_color_code: 1 });
    applyModeAccessSubset(c);
    expect(c.ctcss_tx).toBe(100);
    expect(c.dmr_color_code).toBe(1);
  });
  it("idempotent (running twice = once)", () => {
    const c = makeChannel({
      mode_effective: "DMR",
      ctcss_tx: 100,
      dmr_color_code: 1,
      access_raw: "x",
    });
    const once = applyModeAccessSubset(c);
    const twice = applyModeAccessSubset(once);
    expect(twice).toEqual(once);
  });
  it("classifyChannel matches mode_effective for sk6ba", () => {
    expect(classifyChannel(makeChannel({ mode_effective: "FM" }))).toBe("analog");
    expect(classifyChannel(makeChannel({ mode_effective: "C4FM" }))).toBe("c4fm");
  });
});
