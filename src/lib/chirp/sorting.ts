import type { NormalizedChannel, SortSettings } from "./models";
import { encodeGeohash } from "./geohash";

export function sortChannels(channels: NormalizedChannel[], s: SortSettings): NormalizedChannel[] {
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
          av = a.c.district || "~";
          bv = b.c.district || "~";
          // numeric districts sorted numerically
          if (/^\d+$/.test(String(av)) && /^\d+$/.test(String(bv))) {
            av = Number(av); bv = Number(bv);
          }
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
