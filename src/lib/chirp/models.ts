export type WarningCode =
  | "missing_output"
  | "invalid_output"
  | "unclear_shift"
  | "missing_access_tone"
  | "missing_coords"
  | "empty_name"
  | "name_collision"
  | "unknown_mode"
  | "unknown_type"
  | "pack_missing_required"
  | "pack_invalid_boolean"
  | "pack_duplicate_source_id"
  | "pack_invalid_frequency"
  | "pack_no_name_source"
  | "pack_unsupported_mode"
  | "pack_split_unsupported"
  | "freq_duplicate"
  | "rx_only_no_policy"
  | "rx_only_marked";

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface RawRow {
  [key: string]: string;
}

export type SourceType = "sk6ba" | "channel_pack";

export interface NormalizedChannel {
  source_type: SourceType;
  source_row: number;
  source_id: string;
  // SK6BA fields (also used by packs where applicable)
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
  duplex: "" | "+" | "-" | "split" | "off";
  offset: number;
  ctcss_tx: number | null;
  uses_1750: boolean;
  lat: number | null;
  lng: number | null;
  locator: string;
  comment: string;
  // Channel pack fields
  pack_id: string;
  service: string;
  category: string;
  tags: string[];
  label: string;
  name_hint: string;
  tx_frequency: number | null;
  mode_chirp: string; // suggested CHIRP Mode for pack rows (NFM/FM/USB/CW)
  tstep: number | null;
  tone_raw: string;
  rtone_freq: number | null;
  ctone_freq: number | null;
  dtcs_code: string;
  dtcs_polarity: string;
  skip_raw: string;
  tx_allowed: boolean;
  rx_only: boolean;
  license_note: string;
  source: string;
  source_url: string;
  inferred_from_range: boolean;
  // Naming / output
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
  components: string[];
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
    districtPrefix: string;
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

export type PackPlacement = "off" | "prepend" | "append";
export type FreqDupePolicy = "keep_both" | "drop_pack" | "drop_sk6ba" | "stop";
export type RxOnlyPolicy = "mark" | "duplex_off" | "skip" | "stop";

export interface PackSelectionEntry {
  /** Pack is included in export at all */
  enabled: boolean;
  bands: string[];
  categories: string[];
  tags: string[];
  /** Restrict to rows where enabled_default=true */
  useEnabledDefault: boolean;
  /** Manual allowlist of source_ids — overrides band/cat/tag/enabled_default */
  manualSourceIds?: string[];
  /** Per-pack naming override. If omitted, DEFAULT_PACK_NAMING from defaults.ts is used. */
  naming?: NamingSettings;
}

export interface PackSelection {
  [packId: string]: PackSelectionEntry;
}

export interface ChannelPackSettings {
  placement: PackPlacement;
  selection: PackSelection;
  freqDupePolicy: FreqDupePolicy;
  rxOnlyPolicy: RxOnlyPolicy;
}

export interface Settings {
  filter: FilterSettings;
  naming: NamingSettings;
  chirp: ChirpSettings;
  sort: SortSettings;
  packs: ChannelPackSettings;
}
