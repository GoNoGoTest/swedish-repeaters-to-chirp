export type WarningCode =
  | "missing_output"
  | "invalid_output"
  | "unclear_shift"
  | "missing_access_tone"
  | "missing_coords"
  | "empty_name"
  | "name_collision"
  | "unknown_mode"
  | "unknown_type";

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface RawRow {
  [key: string]: string;
}

export interface NormalizedChannel {
  source_row: number;
  source_id: string;
  type: string;
  status: string;
  mode_raw: string;
  is_analog_fm: boolean;
  band: string;
  district: string;
  city: string;
  call: string;
  channel: string;
  network: string;
  network_id: string;
  access_raw: string;
  rx_frequency: number | null;
  tx_shift_raw: string;
  tx_shift: number | null;
  shift_unclear: boolean;
  duplex: "" | "+" | "-";
  offset: number;
  ctcss_tx: number | null;
  uses_1750: boolean;
  lat: number | null;
  lng: number | null;
  locator: string;
  comment: string;
  generated_name_full: string;
  generated_name_final: string;
  collided: boolean;
  warnings: Warning[];
}

export interface FilterSettings {
  statuses: string[];
  types: string[];
  modeStrategy: "contains_fm" | "exact_fm" | "all" | "custom";
  customModes: string[];
  bands: string[];
  districts: string[];
  includeUnknownDistricts: boolean;
}

export interface NamingSettings {
  components: string[]; // e.g. ["{district}","{city}"]
  separator: string;
  maxLength: number;
  cityMaxLength: number;
  transliterate: boolean;
  uppercase: boolean;
  collisionPolicy: "numeric_suffix" | "last_char_suffix" | "stop";
  abbreviations: {
    type: Record<string, string>;
    network: Record<string, string>;
    band: Record<string, string>;
    districtPrefix: string; // e.g. "D"
  };
}

export interface ChirpSettings {
  startLocation: number;
  mode: "NFM" | "FM";
  tStep: number;
  skipLinks: boolean;
  cToneFreq: number;
}

export interface SortSettings {
  keys: Array<"district" | "geohash" | "type" | "city" | "frequency">;
  geohashPrecision: number;
}

export interface Settings {
  filter: FilterSettings;
  naming: NamingSettings;
  chirp: ChirpSettings;
  sort: SortSettings;
}
