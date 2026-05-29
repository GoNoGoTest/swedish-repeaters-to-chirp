import { describe, it, expect } from "vitest";
import { encodeGeohash } from "../geohash";
import { sortChannels } from "../sorting";
import { DEFAULT_SETTINGS } from "../defaults";
import { makeChannel } from "./helpers";

describe("encodeGeohash", () => {
  it("encodes known coordinate (Borås ≈ u6scz)", () => {
    const h = encodeGeohash(57.7210, 12.9401, 5);
    expect(h).toHaveLength(5);
    expect(h.startsWith("u")).toBe(true);
  });
  it("nearby points share prefix", () => {
    const a = encodeGeohash(57.72, 12.94, 4);
    const b = encodeGeohash(57.73, 12.95, 4);
    expect(a.slice(0, 3)).toBe(b.slice(0, 3));
  });
});

describe("sortChannels", () => {
  const sort = DEFAULT_SETTINGS.sort;
  it("sorts by district numerically then city", () => {
    const c1 = makeChannel({ district: "10", city: "Alfa" });
    const c2 = makeChannel({ district: "2", city: "Zeta" });
    const c3 = makeChannel({ district: "6", city: "Mid" });
    const sorted = sortChannels([c1, c2, c3], sort);
    expect(sorted.map((c) => c.district)).toEqual(["2", "6", "10"]);
  });

  it("places rows without coords last in geohash key", () => {
    const c1 = makeChannel({ district: "6", lat: 57.7, lng: 12.9 });
    const c2 = makeChannel({ district: "6", lat: null, lng: null });
    const sorted = sortChannels([c2, c1], { ...sort, keys: ["geohash"] });
    expect(sorted[0]).toBe(c1);
  });
});
