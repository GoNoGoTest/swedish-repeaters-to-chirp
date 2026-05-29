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
    expect(applyFilters([ch], { ...f, includeUnknownDistricts: false })).toHaveLength(0);
    expect(applyFilters([ch], { ...f, includeUnknownDistricts: true })).toHaveLength(1);
  });
});
