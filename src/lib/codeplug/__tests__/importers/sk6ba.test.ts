import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSk6baCsv, parseNumberLoose, summarize, loadSk6baCsv } from "../../importers/sk6ba";

const csv = readFileSync(resolve(__dirname, "../fixtures/sk6ba-sample.csv"), "utf8");

describe("parseSk6baCsv", () => {
  it("parses all rows and reports no missing required columns", () => {
    const r = parseSk6baCsv(csv);
    expect(r.rows).toHaveLength(6);
    expect(r.missingColumns).toEqual([]);
    expect(r.columns).toContain("output");
  });

  it("parseNumberLoose accepts dot, comma, returns null otherwise", () => {
    expect(parseNumberLoose("145.6")).toBeCloseTo(145.6);
    expect(parseNumberLoose("145,6")).toBeCloseTo(145.6);
    expect(parseNumberLoose("foo")).toBeNull();
    expect(parseNumberLoose("")).toBeNull();
  });

  it("summarize counts categories", () => {
    const r = parseSk6baCsv(csv);
    const s = summarize(r.rows, r.columns);
    expect(s.totalRows).toBe(6);
    expect(s.uniqueCounts.type.Repeater).toBe(4);
    expect(s.uniqueCounts.status.QRV).toBe(5);
    expect(s.unclearShift).toBeGreaterThanOrEqual(1);
  });
});
