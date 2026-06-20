import Papa from "papaparse";
import type { NormalizedChannel, Warning } from "../models";
import { registerTarget } from "./registry";
import type { ExportTarget, HardwareLimits } from "./types";

/**
 * Nicsure firmware (Radtel RT-880) export target.
 *
 * Plain CSV with a fixed 19-column header. Frequencies in MHz with 5 decimal
 * places, tones as either "None", CTCSS (e.g. "67.0") or DCS (e.g. "D051N"
 * with polarity letter), and four single-letter "Slot" group memberships
 * (used by the radio to scope scan lists / zones). Empty slots are written
 * as a single space — matching the Nicsure example file byte-for-byte.
 */

export type NicsurePower = "Very High" | "High" | "Medium" | "Low";
export type NicsureBandwidth = "Wide" | "Narrow";

export interface NicsureRt880Settings {
  /** Number for the first channel row; subsequent rows increment by 1. */
  startLocation: number;
  /** Maximum length of the Name column (truncation only, no padding). */
  maxLength: number;
  /** Default TX power written on every row. */
  defaultPower: NicsurePower;
  /** Default bandwidth when the channel has no mode hint. */
  defaultBandwidth: NicsureBandwidth;
  /** Emit a country letter (S/N/D/F) in Slot1. */
  slotCountry: boolean;
  /** Emit the first digit of `district` (e.g. SM6 → 6) in Slot2. */
  slotDistrict: boolean;
  /** Emit a channel-type letter (R/L/H/S) in Slot3. */
  slotType: boolean;
  /** Emit a pack-category letter in Slot4 (repeaters → blank). */
  slotPackCategory: boolean;
}

export const NICSURE_RT880_DEFAULTS: NicsureRt880Settings = {
  startLocation: 1,
  maxLength: 32,
  defaultPower: "Very High",
  defaultBandwidth: "Wide",
  slotCountry: true,
  slotDistrict: true,
  slotType: true,
  slotPackCategory: true,
};

const NICSURE_RT880_LIMITS: HardwareLimits = {
  maxChannels: 999,
  maxNameLength: 32,
  supportedModes: ["NFM", "FM", "AM"],
  supportsSplit: false,
  supportsCtcss: true,
  supportsDcs: true,
};

export const NICSURE_RT880_COLUMNS = [
  "Channel_Num",
  "Active",
  "Name",
  "RX",
  "TX",
  "RX_Tone",
  "TX_Tone",
  "TX_Power",
  "Slot1",
  "Slot2",
  "Slot3",
  "Slot4",
  "Bandwidth",
  "Modulation",
  "BusyLock",
  "Reversed",
  "PTTID",
  "Clarifier",
  "Scrambler",
] as const;

const EMPTY_SLOT = " ";

function truncateName(raw: string, maxLen: number): { name: string; truncated: boolean } {
  const chars = Array.from(raw);
  if (chars.length <= maxLen) return { name: raw, truncated: false };
  return { name: chars.slice(0, maxLen).join(""), truncated: true };
}

/** Mobile-side TX frequency in MHz, or null. Mirrors vgc-n76.mobileTxMhz. */
function mobileTxMhz(c: NormalizedChannel): number | null {
  if (c.tx_frequency != null) return c.tx_frequency;
  if (c.rx_frequency == null) return null;
  if (c.duplex === "+" || c.duplex === "-") {
    const shift = c.tx_shift != null ? c.tx_shift : (c.duplex === "+" ? c.offset : -c.offset);
    return c.rx_frequency + shift;
  }
  if (c.duplex === "off") return c.rx_frequency;
  return c.rx_frequency;
}

function formatMhz5(mhz: number | null): string {
  return (mhz ?? 0).toFixed(5);
}

/**
 * Encode tone for a given side.
 *  - "None" when no tone is present on that side
 *  - CTCSS as "XX.X" (one decimal)
 *  - DCS as "D" + 3-digit code + polarity letter (N/I)
 *
 * DCS polarity: NormalizedChannel uses a 2-char string per CHIRP convention
 * ("NN"/"NR"/"RN"/"RR" — first char = TX, second = RX). We map per side:
 * 'N' → "N", 'R' → "I" (inverted).
 */
function encodeTone(side: "tx" | "rx", c: NormalizedChannel): string {
  let ctcss: number | null = null;
  if (side === "tx") {
    ctcss = c.rtone_freq ?? c.ctcss_tx ?? null;
  } else {
    ctcss = c.ctone_freq;
    if (ctcss == null) {
      const t = c.tone_raw.toUpperCase();
      if (t === "TSQL") ctcss = c.rtone_freq ?? c.ctcss_tx ?? null;
    }
  }
  if (ctcss != null) return ctcss.toFixed(1);
  if (c.dtcs_code) {
    const digits = c.dtcs_code.padStart(3, "0").slice(-3);
    const pol = c.dtcs_polarity || "NN";
    const polChar = side === "tx" ? pol.charAt(0) : pol.charAt(1);
    const letter = polChar === "R" ? "I" : "N";
    return `D${digits}${letter}`;
  }
  return "None";
}

function encodeBandwidth(c: NormalizedChannel, s: NicsureRt880Settings): NicsureBandwidth {
  const m = (c.mode_chirp || "").toUpperCase();
  if (m === "NFM") return "Narrow";
  if (m === "FM" || m === "AM") return "Wide";
  return s.defaultBandwidth;
}

function encodeModulation(c: NormalizedChannel): { mod: string; unsupported: boolean } {
  const m = (c.mode_chirp || "").toUpperCase();
  if (m === "AM") return { mod: "AM", unsupported: false };
  if (m === "FM" || m === "NFM" || m === "") return { mod: "Auto", unsupported: false };
  // USB / LSB / CW / DV — radio can't decode; emit Auto + warn.
  return { mod: "Auto", unsupported: true };
}

function slotCountry(c: NormalizedChannel): string {
  switch (c.region.countryCode) {
    case "SE": return "S";
    case "NO": return "N";
    case "DK": return "D";
    case "FI": return "F";
    case "AX": return "F"; // Åland — Finnish callsign space
    default: return EMPTY_SLOT;
  }
}

function slotDistrict(c: NormalizedChannel): string {
  if (c.source_type !== "sk6ba") return EMPTY_SLOT;
  const match = (c.district || "").match(/\d/);
  return match ? match[0] : EMPTY_SLOT;
}

function slotType(c: NormalizedChannel): string {
  const t = (c.type || "").toLowerCase();
  if (t === "repeater") return "R";
  if (t === "link") return "L";
  if (t === "hotspot") return "H";
  if (t === "simplex") return "S";
  return EMPTY_SLOT;
}

function slotPackCategory(c: NormalizedChannel): string {
  if (c.source_type !== "channel_pack") return EMPTY_SLOT;
  const cat = (c.category || "").trim();
  if (!cat) return EMPTY_SLOT;
  return cat.charAt(0).toUpperCase();
}

interface NicsureRow {
  Channel_Num: string;
  Active: string;
  Name: string;
  RX: string;
  TX: string;
  RX_Tone: string;
  TX_Tone: string;
  TX_Power: string;
  Slot1: string;
  Slot2: string;
  Slot3: string;
  Slot4: string;
  Bandwidth: string;
  Modulation: string;
  BusyLock: string;
  Reversed: string;
  PTTID: string;
  Clarifier: string;
  Scrambler: string;
}

export function toNicsureRows(
  channels: NormalizedChannel[],
  s: NicsureRt880Settings,
): { rows: NicsureRow[]; warnings: Warning[] } {
  const warnings: Warning[] = [];
  let truncCount = 0;
  let unsupported = 0;

  const rows: NicsureRow[] = channels.map((c, i) => {
    const { name, truncated } = truncateName(c.generated_name_final, s.maxLength);
    if (truncated) truncCount++;

    const { mod, unsupported: modUnsupported } = encodeModulation(c);
    if (modUnsupported) unsupported++;

    return {
      Channel_Num: String(s.startLocation + i),
      Active: "True",
      Name: name,
      RX: formatMhz5(c.rx_frequency),
      TX: formatMhz5(mobileTxMhz(c)),
      RX_Tone: encodeTone("rx", c),
      TX_Tone: encodeTone("tx", c),
      TX_Power: s.defaultPower,
      Slot1: s.slotCountry ? slotCountry(c) : EMPTY_SLOT,
      Slot2: s.slotDistrict ? slotDistrict(c) : EMPTY_SLOT,
      Slot3: s.slotType ? slotType(c) : EMPTY_SLOT,
      Slot4: s.slotPackCategory ? slotPackCategory(c) : EMPTY_SLOT,
      Bandwidth: encodeBandwidth(c, s),
      Modulation: mod,
      BusyLock: "False",
      Reversed: "False",
      PTTID: "Off",
      Clarifier: "0.00",
      Scrambler: "Off",
    };
  });

  if (truncCount > 0) {
    warnings.push({
      code: "vgc_title_truncated",
      message: `${truncCount} kanalnamn trunkerades till ${s.maxLength} tecken (Nicsure Name-fält).`,
    });
  }
  if (unsupported > 0) {
    warnings.push({
      code: "vgc_unsupported_mode",
      message: `${unsupported} kanal(er) har mode (USB/LSB/CW/DV) som RT-880 inte stöder; exporterade som Auto/${s.defaultBandwidth}.`,
    });
  }
  return { rows, warnings };
}

export function exportNicsureRt880Csv(
  channels: NormalizedChannel[],
  s: NicsureRt880Settings,
): { csv: string; warnings: Warning[] } {
  const { rows, warnings } = toNicsureRows(channels, s);
  const data = rows.map((r) => NICSURE_RT880_COLUMNS.map((col) => r[col]));
  const csv = Papa.unparse({ fields: [...NICSURE_RT880_COLUMNS], data });
  return { csv, warnings };
}

export const NICSURE_RT880_TARGET: ExportTarget<NicsureRt880Settings> = {
  id: "nicsure-rt880",
  label: "Nicsure firmware (Radtel RT-880)",
  vendor: "Nicsure",
  description:
    "CSV för Nicsures custom firmware till Radtel RT-880. 19 kolumner, frekvenser i MHz, DCS med polaritet, fyra slot-grupper för zonering.",
  filenameBase: "nicsure-rt880",
  fileExtension: "csv",
  limits: NICSURE_RT880_LIMITS,
  defaultSettings: NICSURE_RT880_DEFAULTS,
  resolveMaxNameLength: (s) => s.maxLength,
  validate: (channels, s) => toNicsureRows(channels, s).warnings,
  export: (channels, s) => {
    const { csv, warnings } = exportNicsureRt880Csv(channels, s);
    return { filename: "nicsure-rt880.csv", content: csv, warnings };
  },
};

registerTarget(NICSURE_RT880_TARGET);
