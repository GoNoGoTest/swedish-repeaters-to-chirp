import type { NamingSettings, Settings } from "./models";
import { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS, VGC_N76_TARGET, VGC_N76_DEFAULTS } from "./targets";

/**
 * Standardnamn för repeatrar/länkar/hotspots från SK6BA-importen.
 * Ordning: distrikt – band – nätverk – ort – signal.
 * Klipps till maxLength i CHIRP-inställningarna.
 */
export const DEFAULT_REPEATER_NAMING: NamingSettings = {
  components: ["{district}", "{band}", "{network}", "{city}", "{call}"],
  separator: "-",
  cityMaxLength: 6,
  transliterate: true,
  uppercase: true,
  collisionPolicy: "numeric_suffix",
  abbreviations: {
    type: { Repeater: "R", Link: "L", Hotspot: "H", Beacon: "B", Static: "" },
    network: {
      "": "",
      SvxReflector: "SVX",
      SvxLink: "SVX",
      Echolink: "EL",
      BrandMeister: "BM",
      Brandmeister: "BM",
      "Wires-X": "WX",
    },
    band: { "2": "2M", "70": "70", "6": "6M", "23": "23", "2m": "2M", "70cm": "70" },
    districtPrefix: "D",
  },
};

/**
 * Standardnamn för kanalpaketsrader. Kanalpaket har ingen ort eller call,
 * så vi prioriterar `name_hint` som ofta innehåller t.ex. "S20", "M01", "PMR1".
 * Tomma fallbacks hanteras i naming.ts: name_hint → channel → label → category.
 */
export const DEFAULT_PACK_NAMING: NamingSettings = {
  components: ["{name_hint}"],
  separator: "-",
  
  cityMaxLength: 6,
  transliterate: true,
  uppercase: true,
  collisionPolicy: "numeric_suffix",
  abbreviations: DEFAULT_REPEATER_NAMING.abbreviations,
};

export const DEFAULT_SETTINGS: Settings = {
  filter: {
    statuses: ["QRV"],
    types: ["Repeater", "Link", "Hotspot"],
    modeStrategy: "contains_fm",
    customModes: [],
    bands: ["2", "70"],
    districts: [],
    includeUnknownDistricts: false,
  },
  naming: DEFAULT_REPEATER_NAMING,
  export: {
    targetId: CHIRP_GENERIC_TARGET.id,
    perTarget: {
      [CHIRP_GENERIC_TARGET.id]: { ...CHIRP_GENERIC_DEFAULTS },
      [VGC_N76_TARGET.id]: { ...VGC_N76_DEFAULTS },
    },
  },
  sort: {
    keys: ["district", "geohash", "city"],
    geohashPrecision: 5,
    qth_maidenhead: "",
    home_district: null,
    home_district_sort: "distance",
    home_district_first: true,
  },
  packs: {
    placement: "append",
    selection: {},
    freqDupePolicy: "keep_both",
    rxOnlyPolicy: "duplex_off",
  },
};
