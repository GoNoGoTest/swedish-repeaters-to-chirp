import Papa from "papaparse";
import type { ChirpSettings, NormalizedChannel, Warning } from "../models";
import { formatFrequency } from "../frequency";

export const CHIRP_COLUMNS = [
  "Location",
  "Name",
  "Frequency",
  "Duplex",
  "Offset",
  "Tone",
  "rToneFreq",
  "cToneFreq",
  "DtcsCode",
  "DtcsPolarity",
  "RxDtcsCode",
  "CrossMode",
  "Mode",
  "TStep",
  "Skip",
  "Power",
  "Comment",
  "URCALL",
  "RPT1CALL",
  "RPT2CALL",
  "DVCODE",
];

// Technical CSV-import defaults. CHIRP/RMS parse these columns as float/int
// even when Tone is empty, so the columns must always carry parsable values.
// These are NOT user-facing access settings.
const DEFAULT_RTONE = "88.5";
const DEFAULT_CTONE = "88.5";
const DEFAULT_DTCS = "023";
const DEFAULT_DTCS_POL = "NN";
const DEFAULT_RX_DTCS = "023";
const DEFAULT_CROSS = "Tone->";
const DEFAULT_POWER = "10.0W";

// Map canonical signal mode (mode_effective) → CHIRP Generic CSV Mode token.
// "FM" intentionally returns null to let the caller fall back to settings.mode
// (NFM vs FM is a per-export user choice for analog).
function mapEffectiveMode(m: string): string | null {
  switch (m) {
    case "C4FM":
      return "DN";
    case "D-Star":
      return "DV";
    case "DMR":
      return "DMR";
    case "DMRplus":
      return "DMR";
    case "P25":
      return "P25";
    case "CW":
      return "CW";
    case "FM":
      return null; // use analog fallback
    case "Tetra":
      return null; // unsupported by Generic CSV → fallback
    default:
      return null; // unknown / empty → fallback
  }
}

function resolveMode(c: NormalizedChannel, fallback: string): string {
  // Channel-pack explicit CHIRP mode wins (e.g. USB/LSB/AM/CW).
  if (c.source_type === "channel_pack" && c.mode_pack) return c.mode_pack;
  const mapped = mapEffectiveMode(c.mode_effective);
  return mapped ?? fallback;
}

const DIGITAL_MODES = new Set(["C4FM", "D-Star", "DMR", "DMRplus", "P25"]);

/**
 * Returns a single non-blocking warning when the export contains at least
 * one channel with a digital effective mode. CHIRP Generic CSV can carry
 * Mode=DN/DV/DMR/P25 but full radio support depends on driver/model and
 * system-specific fields (talkgroup, color code, slot, Fusion params) are
 * not part of the Generic CSV schema.
 */
export function chirpDigitalWarnings(channels: NormalizedChannel[]): Warning[] {
  const has = channels.some((c) => DIGITAL_MODES.has(c.mode_effective));
  if (!has) return [];
  return [
    {
      code: "chirp_digital_partial",
      message:
        "CHIRP Generic CSV kan bära digitala mode-värden (DN, DV, DMR, P25), men " +
        "fullt stöd beror på radiomodell och CHIRP-drivrutin. Systemspecifika " +
        "inställningar som DMR talkgroup, color code, timeslot eller Fusion-" +
        "parametrar ingår inte och kan behöva kompletteras manuellt.",
    },
  ];
}

function resolveTStep(c: NormalizedChannel, fallback: number): number {
  if (c.source_type === "channel_pack" && c.tstep != null) return c.tstep;
  return fallback;
}

function resolveDuplexAndOffset(c: NormalizedChannel): { duplex: string; offset: string } {
  if (c.duplex === "split" && c.tx_frequency != null) {
    return { duplex: "split", offset: c.tx_frequency.toFixed(6) };
  }
  if (c.duplex === "off") {
    return { duplex: "off", offset: c.offset.toFixed(6) };
  }
  return { duplex: c.duplex, offset: c.offset.toFixed(6) };
}

function resolveComment(c: NormalizedChannel): string {
  if (c.source_type === "channel_pack") {
    const parts: string[] = [];
    if (c.comment) parts.push(c.comment);
    if (c.license_note) parts.push(c.license_note);
    if (c.source) parts.push(`src=${c.source}`);
    return parts.join(" | ");
  }
  return c.comment;
}

interface ToneFields {
  Tone: string;
  rToneFreq: string;
  cToneFreq: string;
  DtcsCode: string;
  DtcsPolarity: string;
  RxDtcsCode: string;
  CrossMode: string;
}

const DEFAULT_TONE_FIELDS: ToneFields = {
  Tone: "",
  rToneFreq: DEFAULT_RTONE,
  cToneFreq: DEFAULT_CTONE,
  DtcsCode: DEFAULT_DTCS,
  DtcsPolarity: DEFAULT_DTCS_POL,
  RxDtcsCode: DEFAULT_RX_DTCS,
  CrossMode: DEFAULT_CROSS,
};

function resolveToneFields(c: NormalizedChannel): ToneFields {
  if (c.source_type === "channel_pack") {
    const t = (c.tone_raw || "").trim().toUpperCase();
    if (t === "TSQL") {
      const f = c.ctone_freq ?? c.rtone_freq ?? c.ctcss_tx;
      if (f == null) return { ...DEFAULT_TONE_FIELDS };
      return {
        ...DEFAULT_TONE_FIELDS,
        Tone: "TSQL",
        rToneFreq: f.toFixed(1),
        cToneFreq: f.toFixed(1),
      };
    }
    if (t === "DTCS" || t === "DCS") {
      if (!c.dtcs_code) return { ...DEFAULT_TONE_FIELDS };
      return {
        ...DEFAULT_TONE_FIELDS,
        Tone: "DTCS",
        DtcsCode: c.dtcs_code,
        DtcsPolarity: c.dtcs_polarity || "NN",
      };
    }
    if (t === "TONE" || (t === "" && c.rtone_freq != null)) {
      const f = c.rtone_freq ?? c.ctcss_tx;
      if (f == null) return { ...DEFAULT_TONE_FIELDS };
      return { ...DEFAULT_TONE_FIELDS, Tone: "Tone", rToneFreq: f.toFixed(1) };
    }
    return { ...DEFAULT_TONE_FIELDS };
  }
  if (c.ctcss_tx != null) {
    return { ...DEFAULT_TONE_FIELDS, Tone: "Tone", rToneFreq: c.ctcss_tx.toFixed(1) };
  }
  if (c.dtcs_code) {
    return {
      ...DEFAULT_TONE_FIELDS,
      Tone: "Cross",
      DtcsCode: c.dtcs_code,
      DtcsPolarity: c.dtcs_polarity || "NN",
      CrossMode: "DTCS->",
    };
  }
  return { ...DEFAULT_TONE_FIELDS };
}

export function toChirpRows(channels: NormalizedChannel[], s: ChirpSettings) {
  return channels.map((c, i) => {
    const skip = (s.skipLinks && c.type.toLowerCase() === "link") || c.skip_raw === "S" ? "S" : "";
    const { duplex, offset } = resolveDuplexAndOffset(c);
    const tone = resolveToneFields(c);
    return {
      Location: String(s.startLocation + i),
      Name: c.generated_name_final,
      Frequency: c.rx_frequency != null ? formatFrequency(c.rx_frequency) : "",
      Duplex: duplex,
      Offset: offset,
      Tone: tone.Tone,
      rToneFreq: tone.rToneFreq,
      cToneFreq: tone.cToneFreq,
      DtcsCode: tone.DtcsCode,
      DtcsPolarity: tone.DtcsPolarity,
      RxDtcsCode: tone.RxDtcsCode,
      CrossMode: tone.CrossMode,
      Mode: resolveMode(c, s.mode),
      TStep: resolveTStep(c, s.tStep).toFixed(2),
      Skip: skip,
      Power: DEFAULT_POWER,
      Comment: resolveComment(c),
      URCALL: "",
      RPT1CALL: "",
      RPT2CALL: "",
      DVCODE: "",
    };
  });
}

export function exportChirpCsv(channels: NormalizedChannel[], s: ChirpSettings): string {
  const rows = toChirpRows(channels, s);
  return Papa.unparse({
    fields: CHIRP_COLUMNS,
    data: rows.map((r) => CHIRP_COLUMNS.map((c) => (r as Record<string, unknown>)[c])),
  });
}
