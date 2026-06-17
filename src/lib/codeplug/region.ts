/**
 * Region/country abstraction layered on top of the raw `district` field from
 * the SK6BA repeater CSV. Swedish rows use a 0..7 digit; Nordic / foreign
 * rows use callsign-style prefixes like "LA" (Norway), "OZ" (Denmark),
 * "OH0".."OH9" (Åland/Finland), "TF", "JW", "JX", "OY", "OX".
 *
 * The raw value is preserved on `NormalizedChannel.district`. `deriveRegion`
 * adds normalised metadata used by filters, sorting, naming and split-export
 * so we never need to scatter regex like `/^\d+$/` across the codebase to
 * decide what counts as a Swedish vs unknown district.
 */
export type RegionCountryCode =
  | "SE"
  | "NO"
  | "DK"
  | "FI"
  | "AX"
  | "IS"
  | "SJ"
  | "FO"
  | "GL"
  | "unknown";

export interface RegionInfo {
  /** ISO-ish 2-letter country code (or "unknown"). */
  countryCode: RegionCountryCode;
  /** Localised (sv) country display name. */
  countryName: string;
  /** Trimmed/uppercased raw district value (e.g. "6", "LA", "OH0"). */
  districtCode: string;
  /** Human display label, e.g. "SM6", "LA", "OH0". Used for naming + UI. */
  districtLabel: string;
  /** Sortable string: `${zeroPaddedCountryOrder}-${districtLabel}`. */
  sortKey: string;
  /** True when raw district was 0..7 (Swedish digit). */
  isSwedishDistrict: boolean;
  /** True for any of SE/NO/DK/FI/AX/IS/SJ/FO. (GL flagged separately.) */
  isNordic: boolean;
}

interface RegionMapEntry {
  countryCode: Exclude<RegionCountryCode, "unknown">;
  countryName: string;
  districtLabel: string;
}

/**
 * Authoritative mapping from raw `district` value → region.
 * Swedish digits 0..7 map to SM0..SM7. Nordic/foreign prefixes are added
 * verbatim. OH0 is Åland; OH1..OH9 stay as Finland.
 */
const DISTRICT_REGION_MAP: Record<string, RegionMapEntry> = {
  "0": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM0" },
  "1": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM1" },
  "2": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM2" },
  "3": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM3" },
  "4": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM4" },
  "5": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM5" },
  "6": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM6" },
  "7": { countryCode: "SE", countryName: "Sverige", districtLabel: "SM7" },

  LA: { countryCode: "NO", countryName: "Norge", districtLabel: "LA" },
  OZ: { countryCode: "DK", countryName: "Danmark", districtLabel: "OZ" },

  OH0: { countryCode: "AX", countryName: "Åland", districtLabel: "OH0" },
  OH1: { countryCode: "FI", countryName: "Finland", districtLabel: "OH1" },
  OH2: { countryCode: "FI", countryName: "Finland", districtLabel: "OH2" },
  OH3: { countryCode: "FI", countryName: "Finland", districtLabel: "OH3" },
  OH4: { countryCode: "FI", countryName: "Finland", districtLabel: "OH4" },
  OH5: { countryCode: "FI", countryName: "Finland", districtLabel: "OH5" },
  OH6: { countryCode: "FI", countryName: "Finland", districtLabel: "OH6" },
  OH7: { countryCode: "FI", countryName: "Finland", districtLabel: "OH7" },
  OH8: { countryCode: "FI", countryName: "Finland", districtLabel: "OH8" },
  OH9: { countryCode: "FI", countryName: "Finland", districtLabel: "OH9" },

  TF: { countryCode: "IS", countryName: "Island", districtLabel: "TF" },
  JW: { countryCode: "SJ", countryName: "Svalbard", districtLabel: "JW" },
  JX: { countryCode: "SJ", countryName: "Jan Mayen", districtLabel: "JX" },
  OY: { countryCode: "FO", countryName: "Färöarna", districtLabel: "OY" },
  OX: { countryCode: "GL", countryName: "Grönland", districtLabel: "OX" },
};

/**
 * Ordering used by split-export, sort, and the filter panel. Lower = earlier.
 * Chosen so SE comes first, then NO, DK, FI, AX (between FI and IS so Åland
 * sits next to Finland), IS, SJ (Svalbard+Jan Mayen), FO, GL, unknown last.
 */
export const COUNTRY_SORT_ORDER: Record<RegionCountryCode, number> = {
  SE: 10,
  NO: 20,
  DK: 30,
  FI: 40,
  AX: 45,
  IS: 50,
  SJ: 60,
  FO: 70,
  GL: 80,
  unknown: 999,
};

export const COUNTRY_NAMES: Record<RegionCountryCode, string> = {
  SE: "Sverige",
  NO: "Norge",
  DK: "Danmark",
  FI: "Finland",
  AX: "Åland",
  IS: "Island",
  SJ: "Svalbard/Jan Mayen",
  FO: "Färöarna",
  GL: "Grönland",
  unknown: "Okänt",
};

/** Country codes considered "Nordic" — used by the "Norden" quick filter. */
export const NORDIC_COUNTRY_CODES: RegionCountryCode[] = [
  "SE",
  "NO",
  "DK",
  "FI",
  "AX",
  "IS",
];

function padOrder(order: number): string {
  return order.toString().padStart(3, "0");
}

function makeSortKey(countryCode: RegionCountryCode, districtLabel: string): string {
  return `${padOrder(COUNTRY_SORT_ORDER[countryCode])}-${districtLabel}`;
}

/** Singleton used for channels that have no district (channel-pack rows). */
export const UNKNOWN_REGION: RegionInfo = {
  countryCode: "unknown",
  countryName: COUNTRY_NAMES.unknown,
  districtCode: "",
  districtLabel: "",
  sortKey: makeSortKey("unknown", "~"),
  isSwedishDistrict: false,
  isNordic: false,
};

/**
 * Derive a `RegionInfo` from the raw district value.
 *
 * `callRaw` is accepted for forward compatibility but intentionally unused
 * — we do NOT infer LA/OZ region from callsign prefixes today, because the
 * SK6BA dataset always carries the explicit district value and inferring
 * would risk misclassifying personal callsigns.
 */
export function deriveRegion(districtRaw: string, _callRaw?: string): RegionInfo {
  const code = (districtRaw ?? "").toString().trim().toUpperCase();
  if (!code) return UNKNOWN_REGION;

  const entry = DISTRICT_REGION_MAP[code];
  if (entry) {
    const isSwedishDistrict = /^[0-7]$/.test(code);
    const isNordic = entry.countryCode !== "GL"; // GL is technically not Nordic
    return {
      countryCode: entry.countryCode,
      countryName: entry.countryName,
      districtCode: code,
      districtLabel: entry.districtLabel,
      sortKey: makeSortKey(entry.countryCode, entry.districtLabel),
      isSwedishDistrict,
      isNordic,
    };
  }

  return {
    countryCode: "unknown",
    countryName: COUNTRY_NAMES.unknown,
    districtCode: code,
    districtLabel: code,
    sortKey: makeSortKey("unknown", code),
    isSwedishDistrict: false,
    isNordic: false,
  };
}
