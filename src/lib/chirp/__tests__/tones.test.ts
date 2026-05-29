import { describe, it, expect } from "vitest";
import { parseAccess } from "../tones";

describe("parseAccess", () => {
  it("returns null/false for empty", () => {
    expect(parseAccess("")).toEqual({ ctcss: null, uses1750: false, carrier: false });
    expect(parseAccess(null)).toEqual({ ctcss: null, uses1750: false, carrier: false });
  });

  it("detects 1750 separately from ctcss", () => {
    const r = parseAccess("1750");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeNull();
    expect(r.carrier).toBe(false);
  });

  it("extracts CTCSS in valid range", () => {
    const r = parseAccess("123.0");
    expect(r.ctcss).toBeCloseTo(123.0);
    expect(r.uses1750).toBe(false);
    expect(r.carrier).toBe(false);
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
    expect(parseAccess("88.5;1750").ctcss).toBeCloseTo(88.5);
    expect(parseAccess("88.5|1750").ctcss).toBeCloseTo(88.5);
  });

  it("preserves decimal comma in access (e.g. '1750 / 156,7 / DTMF 6')", () => {
    const r = parseAccess("1750 / 156,7 / DTMF 6");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeCloseTo(156.7);
  });

  it("recognises 'Carrier' as explicit no-tone access", () => {
    const r = parseAccess("Carrier");
    expect(r.carrier).toBe(true);
    expect(r.ctcss).toBeNull();
    expect(r.uses1750).toBe(false);
  });

  it("recognises carrier alongside 1750", () => {
    const r = parseAccess("1750/Carrier");
    expect(r.carrier).toBe(true);
    expect(r.uses1750).toBe(true);
  });

  it("recognises common no-tone synonyms", () => {
    expect(parseAccess("open").carrier).toBe(true);
    expect(parseAccess("none").carrier).toBe(true);
    expect(parseAccess("ingen").carrier).toBe(true);
  });
});
