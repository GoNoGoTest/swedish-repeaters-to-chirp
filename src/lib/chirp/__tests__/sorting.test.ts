import { describe, it, expect } from "vitest";
import { sortChannels } from "../sorting";
import { DEFAULT_SETTINGS } from "../defaults";
import { makeChannel } from "./helpers";

const baseSort = DEFAULT_SETTINGS.sort;

describe("sortChannels — legacy (no home district)", () => {
  it("sorts by district numerically then city", () => {
    const c1 = makeChannel({ district: "10", city: "Alfa" });
    const c2 = makeChannel({ district: "2", city: "Zeta" });
    const c3 = makeChannel({ district: "6", city: "Mid" });
    const sorted = sortChannels([c1, c2, c3], { ...baseSort, home_district: null });
    expect(sorted.map((c) => c.district)).toEqual(["2", "6", "10"]);
  });
});

describe("sortChannels — home district by distance", () => {
  it("home district rows are ordered by distance from QTH", () => {
    // QTH JO67bp ≈ 57.6, 14.7 (Jönköping area)
    const near = makeChannel({ district: "7", city: "Near", call: "SK7N", lat: 57.6, lng: 14.7 });
    const mid = makeChannel({ district: "7", city: "Mid", call: "SK7M", lat: 58.5, lng: 14.7 });
    const far = makeChannel({ district: "7", city: "Far", call: "SK7F", lat: 65.0, lng: 14.7 });
    const other = makeChannel({ district: "6", city: "Borås", call: "SK6BA", lat: 57.7, lng: 12.9 });

    const sorted = sortChannels([far, other, mid, near], {
      ...baseSort,
      qth_maidenhead: "JO67bp",
      home_district: "7",
      home_district_sort: "distance",
      home_district_first: true,
    });

    expect(sorted.map((c) => c.city)).toEqual(["Near", "Mid", "Far", "Borås"]);
  });

  it("rows in home district without coords sort last within home", () => {
    const a = makeChannel({ district: "7", city: "WithCoord", lat: 57.6, lng: 14.7 });
    const b = makeChannel({ district: "7", city: "NoCoord", lat: null, lng: null });
    const sorted = sortChannels([b, a], {
      ...baseSort,
      qth_maidenhead: "JO67bp",
      home_district: "7",
      home_district_sort: "distance",
      home_district_first: true,
    });
    expect(sorted.map((c) => c.city)).toEqual(["WithCoord", "NoCoord"]);
  });

  it("falls back to geohash if QTH is missing/invalid", () => {
    const a = makeChannel({ district: "7", city: "A", lat: 57.6, lng: 14.7 });
    const b = makeChannel({ district: "7", city: "B", lat: 58.0, lng: 14.0 });
    const sorted = sortChannels([a, b], {
      ...baseSort,
      qth_maidenhead: "",
      home_district: "7",
      home_district_sort: "distance",
      home_district_first: true,
    });
    expect(sorted).toHaveLength(2);
  });
});

describe("sortChannels — home_district_first toggle", () => {
  it("places home district last when home_district_first=false", () => {
    const home = makeChannel({ district: "6", city: "Home", lat: 57.7, lng: 12.9 });
    const other = makeChannel({ district: "2", city: "Other", lat: 59.3, lng: 18.0 });
    const sorted = sortChannels([home, other], {
      ...baseSort,
      home_district: "6",
      home_district_sort: "geohash",
      home_district_first: false,
    });
    expect(sorted.map((c) => c.city)).toEqual(["Other", "Home"]);
  });
});

describe("sortChannels — other districts in numeric order", () => {
  it("groups by district numerically when not home", () => {
    const d1 = makeChannel({ district: "1", city: "A", lat: 59, lng: 17 });
    const d2 = makeChannel({ district: "2", city: "B", lat: 59, lng: 18 });
    const d10 = makeChannel({ district: "10", city: "C", lat: 60, lng: 18 });
    const home = makeChannel({ district: "6", city: "Home", lat: 57.7, lng: 12.9 });
    const sorted = sortChannels([d10, d2, d1, home], {
      ...baseSort,
      home_district: "6",
      home_district_sort: "geohash",
      home_district_first: true,
    });
    expect(sorted.map((c) => c.district)).toEqual(["6", "1", "2", "10"]);
  });
});

describe("sortChannels — alphabetical home", () => {
  it("orders home by callsign alphabetically", () => {
    const a = makeChannel({ district: "6", call: "SK6ZZ", city: "Z" });
    const b = makeChannel({ district: "6", call: "SK6AA", city: "A" });
    const sorted = sortChannels([a, b], {
      ...baseSort,
      home_district: "6",
      home_district_sort: "alphabetical",
      home_district_first: true,
    });
    expect(sorted.map((c) => c.call)).toEqual(["SK6AA", "SK6ZZ"]);
  });
});
