import { describe, it, expect } from "vitest";
import { parseModes, isKnownMode, KNOWN_MODES } from "../modes";

describe("parseModes", () => {
  it("returns empty list for empty / nullish input", () => {
    expect(parseModes("")).toEqual([]);
    expect(parseModes(undefined)).toEqual([]);
    expect(parseModes(null)).toEqual([]);
  });

  it("parses a single mode", () => {
    expect(parseModes("FM")).toEqual(["FM"]);
    expect(parseModes("c4fm")).toEqual(["C4FM"]);
  });

  it("splits on slash with surrounding whitespace", () => {
    expect(parseModes("FM / C4FM")).toEqual(["FM", "C4FM"]);
  });

  it("splits on commas, semicolons, pipes", () => {
    expect(parseModes("FM, DMR ; C4FM | D-Star")).toEqual(["FM", "DMR", "C4FM", "D-Star"]);
  });

  it("dedupes while preserving order", () => {
    expect(parseModes("FM/FM/C4FM/FM")).toEqual(["FM", "C4FM"]);
  });

  it("normalises common aliases", () => {
    expect(parseModes("DSTAR")).toEqual(["D-Star"]);
    expect(parseModes("YSF")).toEqual(["C4FM"]);
    expect(parseModes("DN")).toEqual(["C4FM"]);
    expect(parseModes("Fusion")).toEqual(["C4FM"]);
    expect(parseModes("DMR+")).toEqual(["DMRplus"]);
    expect(parseModes("NFM")).toEqual(["FM"]);
  });

  it("drops unknown tokens silently", () => {
    expect(parseModes("FM / frobnicate / C4FM")).toEqual(["FM", "C4FM"]);
    expect(parseModes("blah")).toEqual([]);
  });

  it("handles realistic SK6BA multi-mode strings", () => {
    expect(parseModes("FM / C4FM / DMR / D-Star")).toEqual(["FM", "C4FM", "DMR", "D-Star"]);
  });

  describe("multi-word phrase aliases", () => {
    it("matches 'System Fusion' as a phrase (case-insensitive)", () => {
      expect(parseModes("System Fusion")).toEqual(["C4FM"]);
    });

    it("collapses internal whitespace inside a phrase", () => {
      expect(parseModes("SYSTEM   FUSION")).toEqual(["C4FM"]);
    });

    it("matches a phrase inside a separator-delimited list", () => {
      expect(parseModes("FM / System Fusion / DMR")).toEqual(["FM", "C4FM", "DMR"]);
    });

    it("matches 'D Star' phrase alias", () => {
      expect(parseModes("D Star")).toEqual(["D-Star"]);
    });

    it("still resolves single tokens (Fusion → C4FM)", () => {
      expect(parseModes("Fusion")).toEqual(["C4FM"]);
    });

    it("separator breaks a phrase: only token-level aliases fire", () => {
      // "System" is not a known token, "Fusion" is. The phrase "SYSTEM FUSION"
      // does not match because the two words live in different chunks.
      expect(parseModes("System / Fusion")).toEqual(["C4FM"]);
    });

    it("unknown phrase falls back to tokens and drops unknown tokens", () => {
      expect(parseModes("frobnicate widget")).toEqual([]);
    });
  });
});

describe("isKnownMode", () => {
  it("returns true for canonical modes", () => {
    for (const m of KNOWN_MODES) expect(isKnownMode(m)).toBe(true);
  });
  it("returns false for aliases and junk", () => {
    expect(isKnownMode("YSF")).toBe(false);
    expect(isKnownMode("DSTAR")).toBe(false);
    expect(isKnownMode("")).toBe(false);
  });
});
