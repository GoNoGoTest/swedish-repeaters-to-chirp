import { describe, it, expect } from "vitest";
import { applyFilters } from "../filters";
import { DEFAULT_SETTINGS } from "../defaults";
import { makeChannel } from "./helpers";

const f = DEFAULT_SETTINGS.filter;

describe("applyFilters", () => {
  it("keeps QRV Repeater FM by default", () => {
    const ch = makeChannel({ status: "QRV", type: "Repeater", mode_raw: "FM", band: "2", district: "6" });
    expect(applyFilters([ch], f)).toHaveLength(1);
  });

  it("filters out non-QRV", () => {
    const ch = makeChannel({ status: "QRT" });
    expect(applyFilters([ch], f)).toHaveLength(0);
  });

  it("filters out digital modes when contains_fm", () => {
    const ch = makeChannel({ mode_raw: "DMR" });
    expect(applyFilters([ch], f)).toHaveLength(0);
  });

  it("keeps mixed mode containing FM", () => {
    const ch = makeChannel({ mode_raw: "FM/DMR" });
    expect(applyFilters([ch], f)).toHaveLength(1);
  });

  it("excludes unknown districts unless allowed", () => {
    const ch = makeChannel({ district: "" });
    expect(applyFilters([ch], { ...f, includeUnknownRegions: false })).toHaveLength(0);
    expect(applyFilters([ch], { ...f, includeUnknownRegions: true, countries: [] })).toHaveLength(1);
  });

  it("legacy includeUnknownDistricts still works as alias when new field is undefined", () => {
    const ch = makeChannel({ district: "" });
    const legacy: any = { ...f, includeUnknownRegions: undefined, includeUnknownDistricts: true, countries: [] };
    expect(applyFilters([ch], legacy)).toHaveLength(1);
  });

  it("country filter keeps SE rows, drops NO when SE-only", () => {
    const se = makeChannel({ district: "6" });
    const no = makeChannel({ district: "LA" });
    const res = applyFilters([se, no], { ...f, countries: ["SE"] });
    expect(res.map((c) => c.region.countryCode)).toEqual(["SE"]);
  });

  it("Nordic countries pass with countries=[SE,NO,DK,FI,AX,IS]", () => {
    const rows = ["6", "LA", "OZ", "OH6", "OH0", "TF"]
      .map((d) => makeChannel({ district: d }));
    const res = applyFilters(rows, { ...f, countries: ["SE", "NO", "DK", "FI", "AX", "IS"] });
    expect(res).toHaveLength(6);
  });

  it("region filter narrows within country", () => {
    const sm6 = makeChannel({ district: "6" });
    const sm3 = makeChannel({ district: "3" });
    const res = applyFilters([sm6, sm3], { ...f, regions: ["SM6"] });
    expect(res.map((c) => c.region.districtLabel)).toEqual(["SM6"]);
  });

  it("LA is no longer treated as unknown when SE-only default", () => {
    const la = makeChannel({ district: "LA" });
    // default countries=["SE"] → LA filtered out by country, not by unknown
    const res = applyFilters([la], { ...f, includeUnknownRegions: false });
    expect(res).toHaveLength(0);
    // but with NO in countries, LA passes
    const res2 = applyFilters([la], { ...f, countries: ["NO"] });
    expect(res2).toHaveLength(1);
  });
});
