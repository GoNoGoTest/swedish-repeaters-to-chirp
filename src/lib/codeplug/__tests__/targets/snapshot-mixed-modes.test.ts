/**
 * Regressionssnapshot för VGC/NiCSURE/RT Systems Yaesu: kör hela
 * pipeline + target-export på en blandad SK6BA-input (FM + DMR + C4FM)
 * och låser CSV-output byte-för-byte. Refaktor som påverkar digital
 * access ska INTE ändra denna output — digitala SK6BA-rader filtreras
 * redan bort i VGC/NiCSURE-targets, och RT Systems Yaesu skriver
 * Tone="None" för digitala (analog tone-rensning).
 */
import { describe, it, expect } from "vitest";
import { runPipeline } from "../../pipeline";
import { DEFAULT_SETTINGS } from "../../defaults";
import { exportVgcN76Csv, VGC_N76_DEFAULTS } from "../../targets/vgc-n76";
import { exportNicsureRt880Csv, NICSURE_RT880_DEFAULTS } from "../../targets/nicsure-rt880";
import { exportRtSystemsYaesuCsv, RT_SYSTEMS_YAESU_DEFAULTS } from "../../targets/rt-systems-yaesu";
import type { Settings } from "../../models";

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  filter: {
    ...DEFAULT_SETTINGS.filter,
    statuses: ["QRV"],
    includeUnknownRegions: true,
    countries: [],
    modes: [],
  },
};

const rows = [
  {
    id: "1",
    type: "Repeater",
    status: "QRV",
    mode: "FM",
    output: "145.6000",
    tx_shift: "-0.6",
    band: "2",
    district: "6",
    city: "Borås",
    call: "SK6BA",
    channel: "RV48",
    access: "123.0",
    lat: "57.7",
    lng: "12.9",
  },
  {
    id: "2",
    type: "Repeater",
    status: "QRV",
    mode: "DMR",
    output: "434.6000",
    tx_shift: "-2",
    band: "70",
    district: "6",
    city: "Skene",
    call: "SK6RR",
    channel: "RU368",
    access: "CC 1",
    lat: "57.5",
    lng: "12.6",
  },
  {
    id: "3",
    type: "Repeater",
    status: "QRV",
    mode: "C4FM",
    output: "434.7000",
    tx_shift: "-2",
    band: "70",
    district: "6",
    city: "Bredared",
    call: "SK6RD",
    channel: "RU369",
    access: "TX00 RX00",
    lat: "57.8",
    lng: "12.9",
  },
];

const { channels } = runPipeline({ sk6baRows: rows, settings });

describe("target snapshot regression (blandad FM/DMR/C4FM)", () => {
  it("VGC N76 CSV is byte-stable", () => {
    const { csv } = exportVgcN76Csv(channels, {
      ...VGC_N76_DEFAULTS,
      padToChannels: null,
      reserveAprsSlot32: false,
    });
    expect(csv).toMatchSnapshot();
  });

  it("NiCSURE RT-880 CSV is byte-stable", () => {
    const { csv } = exportNicsureRt880Csv(channels, NICSURE_RT880_DEFAULTS);
    expect(csv).toMatchSnapshot();
  });

  it("RT Systems Yaesu CSV is byte-stable", () => {
    const { csv } = exportRtSystemsYaesuCsv(channels, {
      ...RT_SYSTEMS_YAESU_DEFAULTS,
      padToRows: 0,
    });
    expect(csv).toMatchSnapshot();
  });
});
