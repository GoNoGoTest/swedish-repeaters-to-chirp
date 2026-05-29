import { describe, it, expect } from "vitest";
import { maidenheadToLatLon, isValidMaidenhead } from "../maidenhead";

describe("maidenheadToLatLon", () => {
  it("parses 6-char JO67bp near Jönköping (~57.6, 14.7)", () => {
    const r = maidenheadToLatLon("JO67bp");
    expect(r).not.toBeNull();
    expect(r!.lat).toBeGreaterThan(57.5);
    expect(r!.lat).toBeLessThan(57.7);
    expect(r!.lon).toBeGreaterThan(14.5);
    expect(r!.lon).toBeLessThan(14.9);
  });

  it("parses 4-char locator (lower precision, center of square)", () => {
    const r = maidenheadToLatLon("JO67");
    expect(r).not.toBeNull();
    // JO67 covers lon 14..16, lat 57..58 → center 15, 57.5
    expect(r!.lat).toBeCloseTo(57.5, 1);
    expect(r!.lon).toBeCloseTo(15, 1);
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
