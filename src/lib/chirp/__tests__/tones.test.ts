import { describe, it, expect } from "vitest";
import { parseAccess } from "../tones";

describe("parseAccess", () => {
  it("returns null/false for empty", () => {
    expect(parseAccess("")).toEqual({ ctcss: null, uses1750: false });
    expect(parseAccess(null)).toEqual({ ctcss: null, uses1750: false });
  });

  it("detects 1750 separately from ctcss", () => {
    const r = parseAccess("1750");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeNull();
  });

  it("extracts CTCSS in valid range", () => {
    const r = parseAccess("123.0");
    expect(r.ctcss).toBeCloseTo(123.0);
    expect(r.uses1750).toBe(false);
  });

  it("handles mixed access with 1750 and ctcss", () => {
    const r = parseAccess("1750/123.0");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeCloseTo(123.0);
  });

  it("ignores out-of-range numbers", () => {
    const r = parseAccess("9999");
    expect(r.ctcss).toBeNull();
    expect(r.uses1750).toBe(false);
  });

  it("splits on common delimiters", () => {
    expect(parseAccess("88.5 1750").uses1750).toBe(true);
    expect(parseAccess("88.5,1750").ctcss).toBeCloseTo(88.5);
    expect(parseAccess("88.5|1750").ctcss).toBeCloseTo(88.5);
  });
});
