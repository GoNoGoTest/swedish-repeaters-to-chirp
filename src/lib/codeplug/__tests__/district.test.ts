import { describe, it, expect } from "vitest";
import { extractDistrict } from "../district";

describe("extractDistrict", () => {
  it("parses SK6BA → 6", () => {
    expect(extractDistrict("SK6BA")).toBe("6");
  });
  it("parses SM7XYZ → 7", () => {
    expect(extractDistrict("SM7XYZ")).toBe("7");
  });
  it("parses 7S2A → 2", () => {
    expect(extractDistrict("7S2A")).toBe("2");
  });
  it("handles lowercase + whitespace", () => {
    expect(extractDistrict("  sa0abc ")).toBe("0");
  });
  it("returns null for non-Swedish callsigns", () => {
    expect(extractDistrict("DL1ABC")).toBeNull();
    expect(extractDistrict("W1AW")).toBeNull();
    expect(extractDistrict("")).toBeNull();
  });
});
