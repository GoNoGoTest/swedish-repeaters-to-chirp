import { describe, it, expect } from "vitest";
import { formatBandLabel, parseBandLabel } from "../bands";

describe("band labels", () => {
  it("maps known amateur band codes to display names", () => {
    expect(formatBandLabel("2")).toBe("2m");
    expect(formatBandLabel("70")).toBe("70cm");
    expect(formatBandLabel("23")).toBe("23cm");
    expect(formatBandLabel("13")).toBe("13cm");
    expect(formatBandLabel("6")).toBe("6m");
    expect(formatBandLabel("6cm")).toBe("6cm");
    expect(formatBandLabel("1.5")).toBe("1,25cm");
    expect(formatBandLabel("")).toBe("(tom)");
  });

  it("passes unknown codes through unchanged", () => {
    expect(formatBandLabel("xyz")).toBe("xyz");
  });

  it("parses labels back to raw codes against the known set", () => {
    const known = ["2", "70", "6cm", "1.5", ""];
    expect(parseBandLabel("2m", known)).toBe("2");
    expect(parseBandLabel("70cm", known)).toBe("70");
    expect(parseBandLabel("6cm", known)).toBe("6cm");
    expect(parseBandLabel("1,25cm", known)).toBe("1.5");
    expect(parseBandLabel("(tom)", known)).toBe("");
    expect(parseBandLabel("xyz", known)).toBe("xyz");
  });
});
