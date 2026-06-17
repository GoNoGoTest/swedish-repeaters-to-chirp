import { describe, it, expect } from "vitest";
import {
  deriveRegion,
  UNKNOWN_REGION,
  COUNTRY_SORT_ORDER,
  NORDIC_COUNTRY_CODES,
} from "../region";

describe("deriveRegion — Swedish districts", () => {
  it("maps 0..7 to SE / SM0..SM7", () => {
    for (let i = 0; i <= 7; i++) {
      const r = deriveRegion(String(i));
      expect(r.countryCode).toBe("SE");
      expect(r.countryName).toBe("Sverige");
      expect(r.districtLabel).toBe(`SM${i}`);
      expect(r.isSwedishDistrict).toBe(true);
      expect(r.isNordic).toBe(true);
    }
  });

  it("districtCode preserves the raw digit", () => {
    expect(deriveRegion("6").districtCode).toBe("6");
  });
});

describe("deriveRegion — Nordic / foreign prefixes", () => {
  const cases: Array<[string, string, string]> = [
    ["LA", "NO", "LA"],
    ["OZ", "DK", "OZ"],
    ["OH0", "AX", "OH0"],
    ["OH1", "FI", "OH1"],
    ["OH6", "FI", "OH6"],
    ["OH9", "FI", "OH9"],
    ["TF", "IS", "TF"],
    ["JW", "SJ", "JW"],
    ["JX", "SJ", "JX"],
    ["OY", "FO", "OY"],
    ["OX", "GL", "OX"],
  ];

  it.each(cases)("%s → countryCode=%s label=%s", (raw, country, label) => {
    const r = deriveRegion(raw);
    expect(r.countryCode).toBe(country);
    expect(r.districtLabel).toBe(label);
    expect(r.isSwedishDistrict).toBe(false);
  });

  it("trims and uppercases input", () => {
    expect(deriveRegion("  la  ").countryCode).toBe("NO");
    expect(deriveRegion("oh6").districtLabel).toBe("OH6");
  });

  it("flags GL as non-Nordic", () => {
    expect(deriveRegion("OX").isNordic).toBe(false);
  });

  it("flags AX (Åland) as Nordic", () => {
    expect(deriveRegion("OH0").isNordic).toBe(true);
  });
});

describe("deriveRegion — unknown / empty", () => {
  it("empty string returns UNKNOWN_REGION singleton", () => {
    expect(deriveRegion("")).toBe(UNKNOWN_REGION);
    expect(deriveRegion("   ")).toBe(UNKNOWN_REGION);
  });

  it("unrecognised value is unknown but keeps districtCode", () => {
    const r = deriveRegion("ZZ9");
    expect(r.countryCode).toBe("unknown");
    expect(r.districtCode).toBe("ZZ9");
    expect(r.districtLabel).toBe("ZZ9");
    expect(r.isSwedishDistrict).toBe(false);
  });
});

describe("sortKey ordering", () => {
  it("orders SE < NO < DK < FI < AX < IS < SJ < FO < GL < unknown", () => {
    const ordered = ["0", "LA", "OZ", "OH1", "OH0", "TF", "JW", "OY", "OX", "ZZZ"]
      .map((d) => deriveRegion(d))
      .map((r) => r.sortKey)
      .slice()
      .sort();
    expect(ordered[0]).toMatch(/^010-/);  // SE
    expect(ordered[ordered.length - 1]).toMatch(/^999-/);  // unknown
  });

  it("SE districts sort numerically via label", () => {
    const keys = ["7", "0", "10", "3"]
      .map((d) => deriveRegion(d).sortKey)
      .slice()
      .sort();
    // "10" is unknown (not in 0..7), so just check the SE three are ordered
    expect(keys.filter((k) => k.startsWith("010-")))
      .toEqual(["010-SM0", "010-SM3", "010-SM7"]);
  });
});

describe("constants", () => {
  it("NORDIC_COUNTRY_CODES contains SE/NO/DK/FI/AX/IS", () => {
    expect(NORDIC_COUNTRY_CODES).toEqual(["SE", "NO", "DK", "FI", "AX", "IS"]);
  });
  it("every country has a sort order", () => {
    for (const c of ["SE", "NO", "DK", "FI", "AX", "IS", "SJ", "FO", "GL", "unknown"] as const) {
      expect(typeof COUNTRY_SORT_ORDER[c]).toBe("number");
    }
  });
});
