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

  describe("SK6BA 'Duplex N' format", () => {
    it("'Duplex 0' → simplex", () => {
      expect(parseShift("Duplex 0")).toEqual({
        duplex: "",
        offset: 0,
        shift: 0,
        unclear: false,
      });
    });
    it("'Duplex -2' → minus-offset 2", () => {
      const r = parseShift("Duplex -2");
      expect(r.duplex).toBe("-");
      expect(r.offset).toBeCloseTo(2, 6);
      expect(r.shift).toBe(-2);
      expect(r.unclear).toBe(false);
    });
    it("'Duplex +0.6' → plus-offset 0.6", () => {
      const r = parseShift("Duplex +0.6");
      expect(r.duplex).toBe("+");
      expect(r.offset).toBeCloseTo(0.6, 6);
      expect(r.shift).toBeCloseTo(0.6, 6);
      expect(r.unclear).toBe(false);
    });
    it("'Duplex +0,6' (comma decimal)", () => {
      const r = parseShift("Duplex +0,6");
      expect(r.duplex).toBe("+");
      expect(r.offset).toBeCloseTo(0.6, 6);
    });
  });

  it("formats to 6 decimals", () => {
    expect(formatFrequency(145.6)).toBe("145.600000");
  });
});
