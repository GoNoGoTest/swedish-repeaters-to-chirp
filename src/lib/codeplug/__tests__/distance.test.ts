import { describe, it, expect } from "vitest";
import { haversineKm } from "../distance";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm({ lat: 57.7, lon: 12.9 }, { lat: 57.7, lon: 12.9 })).toBe(0);
  });

  it("Göteborg–Stockholm ≈ 397 km", () => {
    const gbg = { lat: 57.7089, lon: 11.9746 };
    const sthlm = { lat: 59.3293, lon: 18.0686 };
    const d = haversineKm(gbg, sthlm);
    expect(d).toBeGreaterThan(390);
    expect(d).toBeLessThan(410);
  });

  it("is symmetric", () => {
    const a = { lat: 57.7, lon: 12.9 };
    const b = { lat: 59.3, lon: 18.0 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});
