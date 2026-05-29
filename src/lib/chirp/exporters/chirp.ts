import Papa from "papaparse";
import type { ChirpSettings, NormalizedChannel } from "../models";
import { formatFrequency } from "../frequency";

export const CHIRP_COLUMNS = [
  "Location","Name","Frequency","Duplex","Offset","Tone","rToneFreq","cToneFreq",
  "DtcsCode","DtcsPolarity","RxDtcsCode","CrossMode","Mode","TStep","Skip",
  "Power","Comment","URCALL","RPT1CALL","RPT2CALL",
];

// Power default is fine — non-tone column. Tone/DCS columns are emitted as
// empty strings when not semantically active for the row.
const DEFAULT_POWER = "10.0W";

function resolveMode(c: NormalizedChannel, fallback: string): string {
  if (c.source_type === "channel_pack" && c.mode_chirp) return c.mode_chirp;
  return fallback;
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

const EMPTY_TONE_FIELDS: ToneFields = {
  Tone: "",
  rToneFreq: "",
  cToneFreq: "",
  DtcsCode: "",
  DtcsPolarity: "",
  RxDtcsCode: "",
  CrossMode: "",
};

function resolveToneFields(c: NormalizedChannel): ToneFields {
  // Pack-row: explicit tone_raw drives the branch.
  if (c.source_type === "channel_pack") {
    const t = (c.tone_raw || "").trim().toUpperCase();
    if (t === "TSQL") {
      const f = c.ctone_freq ?? c.rtone_freq ?? c.ctcss_tx;
      if (f == null) return { ...EMPTY_TONE_FIELDS };
      return { ...EMPTY_TONE_FIELDS, Tone: "TSQL", rToneFreq: f.toFixed(1), cToneFreq: f.toFixed(1) };
    }
    if (t === "DTCS" || t === "DCS") {
      if (!c.dtcs_code) return { ...EMPTY_TONE_FIELDS };
      return {
        ...EMPTY_TONE_FIELDS,
        Tone: "DTCS",
        DtcsCode: c.dtcs_code,
        DtcsPolarity: c.dtcs_polarity || "NN",
      };
    }
    if (t === "TONE" || (t === "" && c.rtone_freq != null)) {
      const f = c.rtone_freq ?? c.ctcss_tx;
      if (f == null) return { ...EMPTY_TONE_FIELDS };
      return { ...EMPTY_TONE_FIELDS, Tone: "Tone", rToneFreq: f.toFixed(1) };
    }
    return { ...EMPTY_TONE_FIELDS };
  }
  // SK6BA-row: CTCSS-TX wins; otherwise DCS-from-access → Cross; else empty.
  if (c.ctcss_tx != null) {
    return { ...EMPTY_TONE_FIELDS, Tone: "Tone", rToneFreq: c.ctcss_tx.toFixed(1) };
  }
  if (c.dtcs_code) {
    return {
      ...EMPTY_TONE_FIELDS,
      Tone: "Cross",
      DtcsCode: c.dtcs_code,
      DtcsPolarity: c.dtcs_polarity || "NN",
      CrossMode: "DTCS->",
    };
  }
  return { ...EMPTY_TONE_FIELDS };
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
    };
  });
}

export function exportChirpCsv(channels: NormalizedChannel[], s: ChirpSettings): string {
  const rows = toChirpRows(channels, s);
  return Papa.unparse({ fields: CHIRP_COLUMNS, data: rows.map((r) => CHIRP_COLUMNS.map((c) => (r as any)[c])) });
}
