import Papa from "papaparse";
import type { NormalizedChannel, Warning } from "../models";
import { registerTarget } from "./registry";
import type { ExportTarget, HardwareLimits } from "./types";

/**
 * VGC N76 export target.
 *
 * The VGC iOS/Android app imports plain CSV with a very specific header
 * (parameter spec embedded in the column names). Frequencies are integer
 * Hz, CTCSS is Hz×100, DCS is the 3-digit octal code as a decimal
 * integer. Disambiguation on read: value < 1000 ⇒ DCS, ≥ 1000 ⇒ CTCSS.
 *
 * Limitations (v1):
 *  - DCS polarity (N/I) is not representable in the file; we emit N only
 *    and warn when the source row carries I-polarity.
 *  - AM is not exposed yet (NormalizedChannel has no AM flag).
 *  - Per-row power/bandwidth override is not exposed; settings apply
 *    target-wide unless the channel pack carries an explicit mode.
 *  - The 32-channels-per-group N76 limit is surfaced as a warning only;
 *    splitting into groups is the user's responsibility for now.
 */

export interface VgcN76Settings {
  /** Max length of the `title` column. UTF-8 chars, not bytes. */
  maxLength: number;
  /** Default TX power letter when the channel has no override. */
  defaultPower: "H" | "M" | "L";
  /** Default bandwidth in Hz when mode is unknown. */
  defaultBandwidth: 12500 | 25000;
  /** N76 hardware constraint — channels per memory group. */
  channelsPerGroup: number;
  /** Pad output with empty rows up to this row count. null = no padding. */
  padToChannels: number | null;
  /** Mirror chirp-generic: omit links from scan (scan=0 for Link/Hotspot rows). */
  skipLinks: boolean;
}

export const VGC_N76_DEFAULTS: VgcN76Settings = {
  maxLength: 16,
  defaultPower: "H",
  defaultBandwidth: 12500,
  channelsPerGroup: 32,
  padToChannels: null,
  skipLinks: false,
};

const VGC_N76_LIMITS: HardwareLimits = {
  maxChannels: 500,
  maxChannelsPerGroup: 32,
  maxNameLength: 16,
  supportedModes: ["NFM", "FM"],
  supportsSplit: true,
  supportsCtcss: true,
  supportsDcs: true,
};

// Exact header as emitted by the VGC app — every paren spec must match
// byte-for-byte or the app rejects the file silently.
export const VGC_N76_COLUMNS = [
  "title",
  "tx_freq",
  "rx_freq",
  "tx_sub_audio(CTCSS=freq/DCS=number)",
  "rx_sub_audio(CTCSS=freq/DCS=number)",
  "tx_power(H/M/L)",
  "bandwidth(12500/25000)",
  "scan(0=OFF/1=ON)",
  "talk around(0=OFF/1=ON)",
  "pre_de_emph_bypass(0=OFF/1=ON)",
  "sign(0=OFF/1=ON)",
  "tx_dis(0=OFF/1=ON)",
  "bclo(0=OFF/1=ON)",
  "mute(0=OFF/1=ON)",
  "rx_modulation(0=FM/1=AM)",
  "tx_modulation(0=FM/1=AM)",
] as const;

/** MHz → integer Hz, rounded to nearest Hz to avoid 6-decimal float drift. */
function mhzToHz(mhz: number): number {
  return Math.round(mhz * 1_000_000);
}

/** Mobile-side TX frequency in MHz, or null if not derivable. */
function mobileTxMhz(c: NormalizedChannel): number | null {
  if (c.tx_frequency != null) return c.tx_frequency;
  if (c.rx_frequency == null) return null;
  if (c.duplex === "+" || c.duplex === "-") {
    const shift = c.tx_shift != null ? c.tx_shift : (c.duplex === "+" ? c.offset : -c.offset);
    return c.rx_frequency + shift;
  }
  if (c.duplex === "off") return c.rx_frequency;
  // Simplex / unknown — TX = RX
  return c.rx_frequency;
}

/**
 * Encode one tone side (tx or rx) to the VGC integer:
 *  - 0  = no tone
 *  - DCS code (1..777) = 3-digit octal as decimal int (D023 → 23)
 *  - CTCSS Hz×100 (≥1000) = e.g. 114.8 Hz → 11480
 */
function encodeTone(side: "tx" | "rx", c: NormalizedChannel): number {
  // CTCSS picks: explicit pack tone first, then SK6BA ctcss_tx (TX-side
  // access tone — also used as RX TSQL fallback when tone_raw=TSQL).
  let freq: number | null = null;
  if (side === "tx") {
    freq = c.rtone_freq ?? c.ctcss_tx ?? null;
  } else {
    freq = c.ctone_freq;
    if (freq == null) {
      const t = c.tone_raw.toUpperCase();
      if (t === "TSQL") freq = c.rtone_freq ?? c.ctcss_tx ?? null;
    }
  }
  if (freq != null) return Math.round(freq * 100);
  if (c.dtcs_code) {
    const n = parseInt(c.dtcs_code, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function encodeBandwidth(c: NormalizedChannel, s: VgcN76Settings): 12500 | 25000 {
  const m = (c.mode_chirp || "").toUpperCase();
  if (m === "NFM") return 12500;
  if (m === "FM") return 25000;
  if (m === "" && c.is_analog_fm) return s.defaultBandwidth;
  return s.defaultBandwidth;
}

function isScanned(c: NormalizedChannel, s: VgcN76Settings): boolean {
  if (c.skip_raw === "S") return false;
  if (s.skipLinks) {
    const t = c.type.toLowerCase();
    if (t === "link" || t === "hotspot") return false;
  }
  return true;
}

function truncateTitle(raw: string, maxLen: number): { title: string; truncated: boolean } {
  // Use Array.from to count visual code points, not UTF-16 units.
  const chars = Array.from(raw);
  if (chars.length <= maxLen) return { title: raw, truncated: false };
  return { title: chars.slice(0, maxLen).join(""), truncated: true };
}

interface VgcRow {
  title: string;
  tx_freq: string;
  rx_freq: string;
  tx_sub: string;
  rx_sub: string;
  power: string;
  bandwidth: string;
  scan: string;
  talk_around: string;
  pre_de_emph: string;
  sign: string;
  tx_dis: string;
  bclo: string;
  mute: string;
  rx_mod: string;
  tx_mod: string;
}

const EMPTY_ROW: VgcRow = {
  title: "",
  tx_freq: "",
  rx_freq: "",
  tx_sub: "",
  rx_sub: "",
  power: "",
  bandwidth: "",
  scan: "",
  talk_around: "",
  pre_de_emph: "",
  sign: "",
  tx_dis: "",
  bclo: "",
  mute: "",
  rx_mod: "",
  tx_mod: "",
};

export function toVgcN76Rows(
  channels: NormalizedChannel[],
  s: VgcN76Settings,
): { rows: VgcRow[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  let truncCount = 0;
  let polLost = 0;
  let unsupported = 0;

  const rows: VgcRow[] = channels.map((c) => {
    const { title, truncated } = truncateTitle(c.generated_name_final, s.maxLength);
    if (truncated) truncCount++;

    if (c.dtcs_code && c.dtcs_polarity && c.dtcs_polarity !== "NN") polLost++;

    const m = (c.mode_chirp || "").toUpperCase();
    if (m && m !== "NFM" && m !== "FM") unsupported++;

    const txMhz = mobileTxMhz(c);
    const rxMhz = c.rx_frequency;

    return {
      title,
      tx_freq: txMhz != null ? String(mhzToHz(txMhz)) : "",
      rx_freq: rxMhz != null ? String(mhzToHz(rxMhz)) : "",
      tx_sub: String(encodeTone("tx", c)),
      rx_sub: String(encodeTone("rx", c)),
      power: s.defaultPower,
      bandwidth: String(encodeBandwidth(c, s)),
      scan: isScanned(c, s) ? "1" : "0",
      talk_around: "0",
      pre_de_emph: "0",
      sign: "1",
      tx_dis: c.rx_only || !c.tx_allowed ? "1" : "0",
      bclo: "0",
      mute: "0",
      rx_mod: "0",
      tx_mod: "0",
    };
  });

  if (truncCount > 0) {
    warnings.push({
      code: "vgc_title_truncated",
      message: `${truncCount} kanalnamn trunkerades till ${s.maxLength} tecken (VGC title-fält).`,
    });
  }
  if (polLost > 0) {
    warnings.push({
      code: "vgc_dcs_polarity_lost",
      message: `${polLost} kanal(er) har DCS med I-polaritet; VGC-CSV stödjer bara N-polaritet — info gick förlorad.`,
    });
  }
  if (unsupported > 0) {
    warnings.push({
      code: "vgc_unsupported_mode",
      message: `${unsupported} kanal(er) har mode som N76 inte stöder (USB/CW/AM/DV); exporterade som ${s.defaultBandwidth === 12500 ? "NFM" : "FM"}.`,
    });
  }
  if (channels.length > s.channelsPerGroup) {
    warnings.push({
      code: "vgc_over_group_limit",
      message: `${channels.length} kanaler överstiger N76:s ${s.channelsPerGroup}/grupp — dela manuellt i flera filer/grupper.`,
    });
  }

  // Optional padding to a fixed row count (some N76 templates expect a
  // fixed length and parse trailing empty rows as "unused slots").
  if (s.padToChannels != null && rows.length < s.padToChannels) {
    const pad = s.padToChannels - rows.length;
    for (let i = 0; i < pad; i++) rows.push({ ...EMPTY_ROW });
  }

  return { rows, warnings };
}

function rowsToCsv(rows: VgcRow[]): string {
  const data = rows.map((r) => [
    r.title,
    r.tx_freq,
    r.rx_freq,
    r.tx_sub,
    r.rx_sub,
    r.power,
    r.bandwidth,
    r.scan,
    r.talk_around,
    r.pre_de_emph,
    r.sign,
    r.tx_dis,
    r.bclo,
    r.mute,
    r.rx_mod,
    r.tx_mod,
  ]);
  return Papa.unparse({ fields: [...VGC_N76_COLUMNS], data });
}

export function exportVgcN76Csv(channels: NormalizedChannel[], s: VgcN76Settings): { csv: string; warnings: Warning[] } {
  const { rows, warnings } = toVgcN76Rows(channels, s);
  return { csv: rowsToCsv(rows), warnings };
}

export const VGC_N76_TARGET: ExportTarget<VgcN76Settings> = {
  id: "vgc-n76",
  label: "VGC N76 (app-CSV)",
  vendor: "VGC",
  fileExtension: "csv",
  limits: VGC_N76_LIMITS,
  defaultSettings: VGC_N76_DEFAULTS,
  resolveMaxNameLength: (s) => s.maxLength,
  validate: (channels, s) => toVgcN76Rows(channels, s).warnings,
  export: (channels, s) => {
    const { csv, warnings } = exportVgcN76Csv(channels, s);
    return { filename: "vgc-n76.csv", content: csv, warnings };
  },
};

registerTarget(VGC_N76_TARGET);
