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
  | "rx_only_marked"
  | "rx_only_blocked"
  | "ctcss_and_dcs"
  | "vgc_over_group_limit"
  | "vgc_dcs_polarity_lost"
  | "vgc_title_truncated"
  | "vgc_unsupported_mode"
  | "nicsure_zone_pool_exhausted"
  | "nicsure_tx_block_unsupported"
  | "rt_unsupported_mode"
  | "rt_name_truncated"
  | "chirp_digital_partial"
  | "vgc_digital_sk6ba_skipped"
  | "nicsure_digital_sk6ba_skipped";

export interface Warning {
  code: WarningCode;
  message: string;
}

export interface RawRow {
  [key: string]: string;
}

export type SourceType = "sk6ba" | "channel_pack";

import type { RegionInfo, RegionCountryCode } from "./region";

export interface NormalizedChannel {
  source_type: SourceType;
  source_row: number;
  source_id: string;
  // SK6BA fields (also used by packs where applicable)
  type: string;
  status: string;
  mode_raw: string;
  /**
   * The single canonical mode this channel will be exported under.
   * For sk6ba rows this is one of `parseModes(mode_raw)`; for channel-pack
   * rows it falls back to `mode_pack` or the row's `mode_raw`. May be
   * an empty string for unknown / unparseable inputs.
   */
  mode_effective: string;
  is_analog_fm: boolean;
  band: string;
  /** Raw district value from the CSV (preserved verbatim). */
  district: string;
  /** Derived country/region metadata (see src/lib/codeplug/region.ts). */
  region: RegionInfo;
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
  /**
   * Pack row's original mode (NFM/FM/AM/USB/LSB/CW) from the channel-pack
   * CSV's `mode` column. Empty string for SK6BA rows. Consumed by the CHIRP,
   * VGC N76 and NiCSURE RT-880 export targets to drive modulation/bandwidth
   * columns for pack rows, bypassing the `mode_effective` mapping.
   */
  mode_pack: string;
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
  /**
   * Selected modes from `KNOWN_MODES` (see modes.ts). Empty = no mode gating
   * (every parsed mode passes). Drives the per-mode expansion step in
   * the pipeline: a row with `mode_raw="FM / C4FM"` and `modes=["FM","C4FM"]`
   * expands into two channels (one per mode).
   */
  modes: string[];
  bands: string[];
  /** Country codes to keep (empty = all). */
  countries: RegionCountryCode[];
  /** District labels (e.g. "SM6", "LA", "OH0") to keep (empty = all within the chosen countries). */
  regions: string[];
  /** Include rows whose region is "unknown". Replaces legacy `includeUnknownDistricts`. */
  includeUnknownRegions: boolean;
  /** @deprecated replaced by `modes`. Kept for migration of old persisted settings. */
  modeStrategy?: "contains_fm" | "exact_fm" | "all" | "custom";
  /** @deprecated replaced by `modes`. Kept for migration of old persisted settings. */
  customModes?: string[];
  /** @deprecated kept for backward compatibility with persisted settings. */
  districts?: string[];
  /** @deprecated alias for `includeUnknownRegions` in legacy persisted settings. */
  includeUnknownDistricts?: boolean;
}

export interface NamingSettings {
  components: string[];
  separator: string;
  cityMaxLength: number;
  transliterate: boolean;
  uppercase: boolean;
  collisionPolicy: "numeric_suffix" | "last_char_suffix" | "stop";
  abbreviations: {
    type: Record<string, string>;
    network: Record<string, string>;
    band: Record<string, string>;
    districtPrefix: string;
    /**
     * Optional shorthand for `{mode}` tokens, e.g. `{ "C4FM": "YSF" }`.
     * Missing entries pass the canonical mode through unchanged.
     */
    mode?: Record<string, string>;
  };
}

export interface ChirpSettings {
  startLocation: number;
  mode: "NFM" | "FM";
  tStep: number;
  skipLinks: boolean;
  /** Max length for the generated channel name. Hardware-specific (radio display width). */
  maxLength: number;
}

export type HomeDistrictSort = "distance" | "geohash" | "alphabetical";

export interface SortSettings {
  keys: Array<"district" | "geohash" | "type" | "city" | "frequency">;
  geohashPrecision: number;
  /** Maidenhead locator (e.g. "JO67bp"). Empty = no QTH set. */
  qth_maidenhead?: string;
  /** Home district digit ("0".."7") or null. */
  home_district?: string | null;
  /** Sort method inside the home district. */
  home_district_sort: HomeDistrictSort;
  /** When true, home district rows appear before other districts. */
  home_district_first: boolean;
}

export type PackPlacement = "off" | "prepend" | "append";
export type FreqDupePolicy = "keep_both" | "drop_pack" | "drop_sk6ba" | "stop";
export type RxOnlyPolicy = "mark" | "block_tx" | "skip" | "stop";

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

/**
 * Splitting behaviour for export. Target-agnostic — targets that don't
 * implement `exportMany` ignore this and emit a single file.
 *  - "single"                 : one CSV (default, unchanged behaviour)
 *  - "per_district"           : one CSV per repeater region (country +
 *                               districtLabel, e.g. SE/SM6, NO/LA, DK/OZ,
 *                               FI/OH6) + one CSV per channel-pack bucket.
 *                               The mode name is kept for backwards
 *                               compatibility with persisted settings.
 *  - "per_district_chunked"   : same as above, but each file is further
 *                               chunked at `chunkSize` rows (to fit
 *                               radio per-group limits like VGC's 32).
 */
export type SplitMode = "single" | "per_district" | "per_district_chunked";

export interface SplitSettings {
  mode: SplitMode;
  /** Chunk size when mode === "per_district_chunked". */
  chunkSize: number;
}

/**
 * Per-target settings storage. `targetId` selects the active export target
 * (see src/lib/codeplug/targets/registry.ts). `perTarget` holds the user's
 * settings for each target id; shape is target-defined (e.g. ChirpSettings
 * for "chirp-generic").
 */
export interface ExportSettings {
  targetId: string;
  perTarget: Record<string, unknown>;
  split: SplitSettings;
}

export interface Settings {
  filter: FilterSettings;
  naming: NamingSettings;
  sort: SortSettings;
  packs: ChannelPackSettings;
  export: ExportSettings;
}
