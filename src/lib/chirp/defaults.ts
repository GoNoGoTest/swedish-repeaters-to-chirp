import type { NamingSettings, Settings } from "./models";

/**
 * Standardnamn för repeatrar/länkar/hotspots från SK6BA-importen.
 * Korta, ortsdrivna namn som passar typiska radio-displayer på 6 tecken.
 */
export const DEFAULT_REPEATER_NAMING: NamingSettings = {
  components: ["{city}"],
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
  maxLength: 6,
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
  chirp: {
    startLocation: 1,
    mode: "NFM",
    tStep: 5.0,
    skipLinks: false,
    cToneFreq: 88.5,
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
