/**
 * Mode → access-class mapping and per-channel mode-medveten subsetting.
 *
 * Bakgrund: NormalizedChannel bär både analoga (ctcss_tx, uses_1750, dtcs_code)
 * och digitala (dmr_color_code, c4fm_dg_id_*, p25_nac) accessfält. När en
 * SK6BA-rad expanderas till en specifik mode ska bara *rätt* subset behållas
 * — en DMR-kanal ska inte få ctcss_tx, en FM-kanal ska inte få dmr_color_code.
 *
 * `applyModeAccessSubset` är ren och returnerar en ny kanal.
 */

import type { NormalizedChannel } from "./models";

export type AccessClass = "analog" | "dmr" | "c4fm" | "dstar" | "p25" | "tetra" | "none";

/**
 * Klassificera en mode-sträng till access-klass. Accepterar synonymer som
 * dyker upp via olika importer/exporter: `DV`/`DN` (CHIRP), `DMR+` (vissa
 * pack-CSV), `DSTAR` (utan bindestreck).
 *
 * Tom mode klassas konservativt som `analog` (SK6BA-rader utan tolkbar mode
 * måste få behålla CTCSS). CW och andra okända modes → `none`, dvs ingen
 * analog tone tillämpas.
 */
export function classifyMode(mode: string): AccessClass {
  const m = (mode || "").trim().toUpperCase();
  if (m === "" || m === "FM" || m === "NFM" || m === "WFM") return "analog";
  if (m === "DMR" || m === "DMRPLUS" || m === "DMR+") return "dmr";
  if (m === "C4FM" || m === "DN") return "c4fm";
  if (m === "D-STAR" || m === "DSTAR" || m === "DV") return "dstar";
  if (m === "P25") return "p25";
  if (m === "TETRA") return "tetra";
  return "none";
}

function effectiveMode(c: NormalizedChannel): string {
  return c.source_type === "channel_pack"
    ? c.mode_pack || c.mode_effective || ""
    : c.mode_effective || "";
}

export function classifyChannel(c: NormalizedChannel): AccessClass {
  return classifyMode(effectiveMode(c));
}

/** True om kanalens mode är analog FM-liknande och därmed bär analog tone. */
export function isAnalogToneMode(c: NormalizedChannel): boolean {
  return classifyChannel(c) === "analog";
}

const ZERO_ANALOG = {
  ctcss_tx: null as number | null,
  uses_1750: false,
  dtcs_code: "",
  dtcs_polarity: "",
  analog_carrier_open: false,
} as const;

const ZERO_DMR = {
  dmr_color_code: null as number | null,
  dmr_timeslot: null as number | null,
  dmr_talkgroup: "",
} as const;

const ZERO_C4FM = {
  c4fm_dg_id_tx: null as number | null,
  c4fm_dg_id_rx: null as number | null,
} as const;

const ZERO_P25 = { p25_nac: "" } as const;

/**
 * Returnera en kopia av kanalen där analog/digital access begränsas till
 * vad mode-klassen tillåter. Idempotent och muterar aldrig input.
 */
export function applyModeAccessSubset(c: NormalizedChannel): NormalizedChannel {
  const cls = classifyChannel(c);
  switch (cls) {
    case "analog":
      return { ...c, ...ZERO_DMR, ...ZERO_C4FM, ...ZERO_P25, digital_access_raw: "" };
    case "dmr":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_C4FM,
        ...ZERO_P25,
        digital_access_raw: c.access_raw,
      };
    case "c4fm":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_DMR,
        ...ZERO_P25,
        digital_access_raw: c.access_raw,
      };
    case "dstar":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_DMR,
        ...ZERO_C4FM,
        ...ZERO_P25,
        digital_access_raw: c.access_raw,
      };
    case "p25":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_DMR,
        ...ZERO_C4FM,
        digital_access_raw: c.access_raw,
      };
    case "tetra":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_DMR,
        ...ZERO_C4FM,
        ...ZERO_P25,
        digital_access_raw: c.access_raw,
      };
    case "none":
      return {
        ...c,
        ...ZERO_ANALOG,
        ...ZERO_DMR,
        ...ZERO_C4FM,
        ...ZERO_P25,
        digital_access_raw: "",
      };
  }
}
