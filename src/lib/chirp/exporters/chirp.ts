import Papa from "papaparse";
import type { ChirpSettings, NormalizedChannel } from "../models";
import { formatFrequency } from "../frequency";

export const CHIRP_COLUMNS = [
  "Location","Name","Frequency","Duplex","Offset","Tone","rToneFreq","cToneFreq",
  "DtcsCode","DtcsPolarity","RxDtcsCode","CrossMode","Mode","TStep","Skip",
  "Comment","URCALL","RPT1CALL","RPT2CALL","DVCODE",
];

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

export function toChirpRows(channels: NormalizedChannel[], s: ChirpSettings) {
  return channels.map((c, i) => {
    const skip = (s.skipLinks && c.type.toLowerCase() === "link") || c.skip_raw === "S" ? "S" : "";
    const tone = c.ctcss_tx != null || c.tone_raw ? (c.tone_raw || "Tone") : "";
    const { duplex, offset } = resolveDuplexAndOffset(c);
    const cTone = c.ctone_freq ?? s.cToneFreq;
    return {
      Location: String(s.startLocation + i),
      Name: c.generated_name_final,
      Frequency: c.rx_frequency != null ? formatFrequency(c.rx_frequency) : "",
      Duplex: duplex,
      Offset: offset,
      Tone: tone,
      rToneFreq: (c.ctcss_tx ?? c.rtone_freq ?? 88.5).toFixed(1),
      cToneFreq: cTone.toFixed(1),
      DtcsCode: c.dtcs_code || "23",
      DtcsPolarity: c.dtcs_polarity || "NN",
      RxDtcsCode: "23",
      CrossMode: "Tone->Tone",
      Mode: resolveMode(c, s.mode),
      TStep: resolveTStep(c, s.tStep).toFixed(1),
      Skip: skip,
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
  return Papa.unparse({ fields: CHIRP_COLUMNS, data: rows.map((r) => CHIRP_COLUMNS.map((c) => (r as any)[c])) });
}
