import type { Settings } from "./models";

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
  naming: {
    components: ["{city}"],
    separator: "",
    maxLength: 6,
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
  },
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
  },
  packs: {
    placement: "off",
    selection: {},
    freqDupePolicy: "keep_both",
    rxOnlyPolicy: "mark",
  },
};
