import Papa from "papaparse";
import type { ChirpSettings, NormalizedChannel } from "../models";
import { formatFrequency } from "../frequency";

export const CHIRP_COLUMNS = [
  "Location","Name","Frequency","Duplex","Offset","Tone","rToneFreq","cToneFreq",
  "DtcsCode","DtcsPolarity","RxDtcsCode","CrossMode","Mode","TStep","Skip",
  "Comment","URCALL","RPT1CALL","RPT2CALL","DVCODE",
];

export function toChirpRows(channels: NormalizedChannel[], s: ChirpSettings) {
  return channels.map((c, i) => {
    const skip = s.skipLinks && c.type.toLowerCase() === "link" ? "S" : "";
    const tone = c.ctcss_tx != null ? "Tone" : "";
    return {
      Location: String(s.startLocation + i),
      Name: c.generated_name_final,
      Frequency: c.rx_frequency != null ? formatFrequency(c.rx_frequency) : "",
      Duplex: c.duplex,
      Offset: c.offset.toFixed(6),
      Tone: tone,
      rToneFreq: (c.ctcss_tx ?? 88.5).toFixed(1),
      cToneFreq: s.cToneFreq.toFixed(1),
      DtcsCode: "23",
      DtcsPolarity: "NN",
      RxDtcsCode: "23",
      CrossMode: "Tone->Tone",
      Mode: s.mode,
      TStep: s.tStep.toFixed(1),
      Skip: skip,
      Comment: c.comment,
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
