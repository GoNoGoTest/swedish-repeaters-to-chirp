import { describe, it, expect } from "vitest";
import { maidenheadToLatLon, isValidMaidenhead } from "../maidenhead";

describe("maidenheadToLatLon", () => {
  it("parses 6-char JO67bp (~Borås, 57.6°N 12.1°E)", () => {
    const r = maidenheadToLatLon("JO67bp");
    expect(r).not.toBeNull();
    // JO67 covers lon 12..14, lat 57..58. Subsquare bp ≈ lon 12.08, lat 57.6.
    expect(r!.lat).toBeGreaterThan(57.5);
    expect(r!.lat).toBeLessThan(57.7);
    expect(r!.lon).toBeGreaterThan(12.0);
    expect(r!.lon).toBeLessThan(12.3);
  });

  it("parses 4-char locator (lower precision, center of square)", () => {
    const r = maidenheadToLatLon("JO67");
    expect(r).not.toBeNull();
    // JO67 covers lon 12..14, lat 57..58 → center 13, 57.5
    expect(r!.lat).toBeCloseTo(57.5, 1);
    expect(r!.lon).toBeCloseTo(13, 1);
  });

  it("parses 8-char locator", () => {
    const r = maidenheadToLatLon("JO67bp12");
    expect(r).not.toBeNull();
  });

  it("rejects invalid input", () => {
    expect(maidenheadToLatLon("")).toBeNull();
    expect(maidenheadToLatLon("ZZ99")).toBeNull(); // Z out of A-R
    expect(maidenheadToLatLon("JO6")).toBeNull(); // odd length
    expect(maidenheadToLatLon("JO67b")).toBeNull(); // odd length
    expect(maidenheadToLatLon("junk")).toBeNull();
  });

  it("isValidMaidenhead matches", () => {
    expect(isValidMaidenhead("JO67bp")).toBe(true);
    expect(isValidMaidenhead("nope")).toBe(false);
  });
});
