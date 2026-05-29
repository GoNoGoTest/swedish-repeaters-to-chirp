import { describe, it, expect } from "vitest";
import { parseShift, formatFrequency } from "../frequency";

describe("parseShift", () => {
  it("treats empty and 'simplex' as no shift", () => {
    expect(parseShift("")).toEqual({ duplex: "", offset: 0, shift: 0, unclear: false });
    expect(parseShift("simplex")).toEqual({ duplex: "", offset: 0, shift: 0, unclear: false });
    expect(parseShift(null)).toEqual({ duplex: "", offset: 0, shift: 0, unclear: false });
  });

  it("parses negative shift", () => {
    const r = parseShift("-0.6");
    expect(r.duplex).toBe("-");
    expect(r.offset).toBeCloseTo(0.6, 6);
    expect(r.unclear).toBe(false);
  });

  it("parses positive shift with explicit +", () => {
    const r = parseShift("+7.6");
    expect(r.duplex).toBe("+");
    expect(r.offset).toBeCloseTo(7.6, 6);
  });

  it("handles comma decimal", () => {
    const r = parseShift("-0,6");
    expect(r.duplex).toBe("-");
    expect(r.offset).toBeCloseTo(0.6, 6);
  });

  it("marks unparsable as unclear", () => {
    const r = parseShift("foo");
    expect(r.unclear).toBe(true);
    expect(r.shift).toBeNull();
  });

  it("formats to 6 decimals", () => {
    expect(formatFrequency(145.6)).toBe("145.600000");
  });
});
