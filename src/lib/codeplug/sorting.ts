import type { NormalizedChannel, SortSettings } from "./models";
import { encodeGeohash } from "./geohash";
import { maidenheadToLatLon } from "./maidenhead";
import { haversineKm } from "./distance";
import { extractDistrict } from "./district";

/** Base sort that runs the configured key list. Used as fallback and for "other districts". */
function sortByKeys(channels: NormalizedChannel[], s: SortSettings): NormalizedChannel[] {
  const withKeys = channels.map((c) => {
    const geohash =
      c.lat != null && c.lng != null ? encodeGeohash(c.lat, c.lng, s.geohashPrecision) : "~";
    return { c, geohash };
  });
  withKeys.sort((a, b) => {
    for (const key of s.keys) {
      let av: string | number = "";
      let bv: string | number = "";
      switch (key) {
        case "district":
          // Region-aware: SE numerically (via SM0..SM7 label sort),
          // other countries grouped per COUNTRY_SORT_ORDER.
          av = a.c.region.sortKey || "~";
          bv = b.c.region.sortKey || "~";
          break;
        case "geohash": av = a.geohash; bv = b.geohash; break;
        case "type": av = a.c.type; bv = b.c.type; break;
        case "city": av = a.c.city; bv = b.c.city; break;
        case "frequency": av = a.c.rx_frequency ?? Infinity; bv = b.c.rx_frequency ?? Infinity; break;
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  });
  return withKeys.map((x) => x.c);
}

/** Resolve a channel's effective district: prefer explicit field, fall back to callsign prefix. */
function districtOf(c: NormalizedChannel): string {
  if (c.district) return c.district;
  return extractDistrict(c.call) ?? "";
}

function sortHomeChannels(
  channels: NormalizedChannel[],
  s: SortSettings,
): NormalizedChannel[] {
  switch (s.home_district_sort) {
    case "distance": {
      const qth = s.qth_maidenhead ? maidenheadToLatLon(s.qth_maidenhead) : null;
      if (!qth) {
        // No valid QTH — fall back to geohash inside home district.
        return sortByKeys(channels, { ...s, keys: ["geohash", "city"] });
      }
      const decorated = channels.map((c) => {
        const dist =
          c.lat != null && c.lng != null
            ? haversineKm(qth, { lat: c.lat, lon: c.lng })
            : Infinity;
        return { c, dist };
      });
      decorated.sort((a, b) => a.dist - b.dist);
      return decorated.map((x) => x.c);
    }
    case "alphabetical": {
      return [...channels].sort((a, b) => {
        const ak = (a.call || a.city || "").toLowerCase();
        const bk = (b.call || b.city || "").toLowerCase();
        return ak < bk ? -1 : ak > bk ? 1 : 0;
      });
    }
    case "geohash":
    default:
      return sortByKeys(channels, { ...s, keys: ["geohash", "city"] });
  }
}

function sortOtherDistricts(
  channels: NormalizedChannel[],
  s: SortSettings,
): NormalizedChannel[] {
  // Group by region sortKey so countries cluster in COUNTRY_SORT_ORDER,
  // and SE districts stay numerically ordered (SM0..SM7).
  const groups = new Map<string, NormalizedChannel[]>();
  for (const c of channels) {
    const key = c.region.sortKey || "~";
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  const keys = Array.from(groups.keys()).sort();
  const out: NormalizedChannel[] = [];
  for (const k of keys) {
    out.push(...sortByKeys(groups.get(k)!, { ...s, keys: ["geohash", "city"] }));
  }
  return out;
}

export function sortChannels(channels: NormalizedChannel[], s: SortSettings): NormalizedChannel[] {
  // No home district set → original behavior.
  if (!s.home_district) {
    return sortByKeys(channels, s);
  }
  const home: NormalizedChannel[] = [];
  const others: NormalizedChannel[] = [];
  for (const c of channels) {
    if (districtOf(c) === s.home_district) home.push(c);
    else others.push(c);
  }
  const homeSorted = sortHomeChannels(home, s);
  const othersSorted = sortOtherDistricts(others, s);
  return s.home_district_first
    ? [...homeSorted, ...othersSorted]
    : [...othersSorted, ...homeSorted];
}
