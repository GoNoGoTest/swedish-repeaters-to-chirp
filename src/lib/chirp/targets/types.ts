import type { NormalizedChannel, Warning } from "../models";

/**
 * Hardware/software limits for a concrete export target (radio or app).
 * Used by target.validate() and by UI to surface constraints. The pipeline
 * does NOT enforce these automatically in this iteration — actual
 * truncation/grouping is the responsibility of each target's exporter.
 */
export interface HardwareLimits {
  /** Total channels the radio can hold (undefined = unlimited / unknown). */
  maxChannels?: number;
  /** Some radios (e.g. VGC N76) group channels with a per-group cap. */
  maxChannelsPerGroup?: number;
  /** Display width in characters for the channel name field. */
  maxNameLength: number;
  /** Modes the target can import. */
  supportedModes: string[];
  supportsSplit: boolean;
  supportsCtcss: boolean;
  supportsDcs: boolean;
  /** Allowed manual-tuning step values in kHz, if the target is picky. */
  toneStepKhz?: number[];
}

export interface ExportResult {
  /** Suggested filename including extension. */
  filename: string;
  /** File body (CSV text, etc.). */
  content: string;
  /** Pre-export validation warnings (non-blocking unless target opts in). */
  warnings: Warning[];
}

export interface ExportTarget<TSettings = unknown> {
  /** Stable id, e.g. "chirp-generic". */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Vendor / family for UI grouping ("CHIRP", "VGC", "RT Systems", ...). */
  vendor: string;
  fileExtension: "csv" | "txt" | string;
  limits: HardwareLimits;
  defaultSettings: TSettings;
  /** Optional pre-export validation against limits. */
  validate?: (channels: NormalizedChannel[], settings: TSettings) => Warning[];
  /** Produce the exportable file. */
  export: (channels: NormalizedChannel[], settings: TSettings) => ExportResult;
  /**
   * Derive the effective max-name-length the pipeline should clip to,
   * given user-tunable settings (may be lower than limits.maxNameLength).
   * Defaults to limits.maxNameLength.
   */
  resolveMaxNameLength?: (settings: TSettings) => number;
}
