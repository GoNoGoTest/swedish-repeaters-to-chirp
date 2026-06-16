import type { ChirpSettings, NormalizedChannel } from "../models";
import { exportChirpCsv } from "../exporters/chirp";
import { registerTarget } from "./registry";
import type { ExportTarget, HardwareLimits } from "./types";

export const CHIRP_GENERIC_DEFAULTS: ChirpSettings = {
  startLocation: 1,
  mode: "NFM",
  tStep: 5.0,
  skipLinks: false,
  maxLength: 6,
};

const CHIRP_GENERIC_LIMITS: HardwareLimits = {
  // CHIRP itself doesn't impose a max; the actual radio does. We keep a
  // sane default name length matching CHIRP_GENERIC_DEFAULTS.maxLength.
  maxNameLength: 6,
  supportedModes: ["NFM", "FM", "AM", "USB", "LSB", "CW", "DV"],
  supportsSplit: true,
  supportsCtcss: true,
  supportsDcs: true,
};

export const CHIRP_GENERIC_TARGET: ExportTarget<ChirpSettings> = {
  id: "chirp-generic",
  label: "CHIRP generic CSV",
  vendor: "CHIRP",
  fileExtension: "csv",
  limits: CHIRP_GENERIC_LIMITS,
  defaultSettings: CHIRP_GENERIC_DEFAULTS,
  resolveMaxNameLength: (s) => s.maxLength,
  export: (channels: NormalizedChannel[], settings: ChirpSettings) => ({
    filename: "chirp.csv",
    content: exportChirpCsv(channels, settings),
    warnings: [],
  }),
};

registerTarget(CHIRP_GENERIC_TARGET);
