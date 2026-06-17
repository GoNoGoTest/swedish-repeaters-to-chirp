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

describe("loadSk6baCsv", () => {
  it("returns status='loaded' with rowCount and summary on a valid file", () => {
    const s = loadSk6baCsv(csv);
    expect(s.status).toBe("loaded");
    if (s.status !== "loaded") return;
    expect(s.rowCount).toBe(6);
    expect(s.rows).toHaveLength(6);
    expect(s.summary.totalRows).toBe(6);
  });

  it("returns status='error' with missingColumns when required columns are absent", () => {
    const broken = "id,call,city\n1,SK6AA,Borås\n";
    const s = loadSk6baCsv(broken);
    expect(s.status).toBe("error");
    if (s.status !== "error") return;
    expect(s.missingColumns).toBeDefined();
    expect(s.missingColumns!.length).toBeGreaterThan(0);
    expect(s.missingColumns).toContain("output");
    expect(s.message).toMatch(/Saknade obligatoriska kolumner/);
  });

  it("returns status='error' on empty input", () => {
    const s = loadSk6baCsv("");
    expect(s.status).toBe("error");
  });
});
