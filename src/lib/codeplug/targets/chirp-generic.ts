import type { ChirpSettings, NormalizedChannel, SplitSettings } from "../models";
import { exportChirpCsv, chirpDigitalWarnings } from "../exporters/chirp";
import { registerTarget } from "./registry";
import { buildSplitFiles } from "./split";
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
  supportedModes: [
    "NFM",
    "FM",
    "WFM",
    "AM",
    "NAM",
    "DV",
    "DN",
    "DMR",
    "P25",
    "CW",
    "USB",
    "LSB",
    "RTTY",
    "DIG",
    "PKT",
  ],
  // CHIRP-CSV is permissive: analog modes export cleanly; digital modes
  // pass through as Mode=DN/DV/DMR/P25 with a non-blocking warning.
  supportedSignalModes: ["FM", "C4FM", "D-Star", "DMR", "DMRplus", "P25", "Tetra", "CW"],
  supportsSplit: true,
  supportsCtcss: true,
  supportsDcs: true,
};

export const CHIRP_GENERIC_TARGET: ExportTarget<ChirpSettings> = {
  id: "chirp-generic",
  label: "CHIRP generic CSV",
  vendor: "CHIRP",
  description:
    "Standard CHIRP-CSV — öppna i CHIRP och importera till valfri radioimage. Bredast hårdvarustöd.",
  filenameBase: "chirp",
  fileExtension: "csv",
  limits: CHIRP_GENERIC_LIMITS,
  defaultSettings: CHIRP_GENERIC_DEFAULTS,
  resolveMaxNameLength: (s) => s.maxLength,
  validate: (channels) => chirpDigitalWarnings(channels),
  export: (channels: NormalizedChannel[], settings: ChirpSettings) => ({
    filename: "chirp.csv",
    content: exportChirpCsv(channels, settings),
    warnings: chirpDigitalWarnings(channels),
  }),
  exportMany: (channels: NormalizedChannel[], settings: ChirpSettings, split: SplitSettings) =>
    buildSplitFiles(channels, split, {
      filenameBase: "chirp",
      extension: "csv",
      // Re-number Location per chunk so each file is internally consistent.
      renderChunk: (chunk) => exportChirpCsv(chunk, settings),
    }),
};

registerTarget(CHIRP_GENERIC_TARGET);
