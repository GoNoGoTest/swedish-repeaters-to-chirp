import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  NICSURE_RT880_TARGET,
  NICSURE_RT880_DEFAULTS,
  NICSURE_RT880_COLUMNS,
  toNicsureRows,
} from "@/lib/codeplug/targets/nicsure-rt880";
import { makeChannel } from "../helpers";

function parseRows(csv: string): string[][] {
  return Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
}

describe("targets/nicsure-rt880", () => {
  it("metadata: id, label, vendor, extension, splits", () => {
    expect(NICSURE_RT880_TARGET.id).toBe("nicsure-rt880");
    expect(NICSURE_RT880_TARGET.vendor).toBe("Nicsure");
    expect(NICSURE_RT880_TARGET.fileExtension).toBe("csv");
    expect(NICSURE_RT880_TARGET.exportMany).toBeUndefined();
  });

  it("header row matches the exact Nicsure spec", () => {
    const out = NICSURE_RT880_TARGET.export([], NICSURE_RT880_DEFAULTS);
    expect(out.content.split(/\r?\n/)[0]).toBe(NICSURE_RT880_COLUMNS.join(","));
  });

  it("formats RX/TX in MHz with 5 decimals and derives mobile TX for duplex", () => {
    const ch = makeChannel({
      generated_name_final: "RPT",
      rx_frequency: 145.725,
      tx_shift: -0.6,
      duplex: "-",
      offset: 0.6,
    });
    const row = parseRows(NICSURE_RT880_TARGET.export([ch], NICSURE_RT880_DEFAULTS).content)[1];
    expect(row[3]).toBe("145.72500"); // RX
    expect(row[4]).toBe("145.12500"); // TX
  });

  it("encodes CTCSS as decimal Hz with 1 decimal", () => {
    const ch = makeChannel({
      generated_name_final: "CTCSS",
      rx_frequency: 145.6,
      tx_shift: -0.6,
      duplex: "-",
      offset: 0.6,
      ctcss_tx: 67,
    });
    const row = parseRows(NICSURE_RT880_TARGET.export([ch], NICSURE_RT880_DEFAULTS).content)[1];
    expect(row[5]).toBe("None"); // RX_Tone
    expect(row[6]).toBe("67.0"); // TX_Tone
  });

  it("encodes DCS as D<3-digit><polarity letter> per side", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "DCS",
      rx_frequency: 462.7,
      tx_frequency: 462.7,
      duplex: "",
      dtcs_code: "51",
      dtcs_polarity: "NR", // TX=N, RX=R(=I)
      tone_raw: "DTCS",
    });
    const row = parseRows(NICSURE_RT880_TARGET.export([ch], NICSURE_RT880_DEFAULTS).content)[1];
    expect(row[5]).toBe("D051I"); // RX side R → I
    expect(row[6]).toBe("D051N"); // TX side N → N
  });

  it("maps mode_chirp to Bandwidth and Modulation", () => {
    const nfm = makeChannel({ rx_frequency: 145.5, mode_chirp: "NFM" });
    const fm = makeChannel({ rx_frequency: 145.5, mode_chirp: "FM" });
    const am = makeChannel({ rx_frequency: 121.5, mode_chirp: "AM", duplex: "" });
    const csv = NICSURE_RT880_TARGET.export([nfm, fm, am], NICSURE_RT880_DEFAULTS).content;
    const rows = parseRows(csv);
    expect([rows[1][12], rows[1][13]]).toEqual(["Narrow", "Auto"]);
    expect([rows[2][12], rows[2][13]]).toEqual(["Wide", "Auto"]);
    expect([rows[3][12], rows[3][13]]).toEqual(["Wide", "AM"]);
  });

  it("warns on unsupported modes (USB/LSB/CW)", () => {
    const ch = makeChannel({ rx_frequency: 14.2, mode_chirp: "USB", duplex: "" });
    const { warnings } = toNicsureRows([ch], NICSURE_RT880_DEFAULTS);
    expect(warnings.some((w) => w.code === "vgc_unsupported_mode")).toBe(true);
  });

  it("Channel_Num honors startLocation and increments", () => {
    const chs = [makeChannel({ rx_frequency: 145.5 }), makeChannel({ rx_frequency: 145.6 })];
    const rows = parseRows(
      NICSURE_RT880_TARGET.export(chs, { ...NICSURE_RT880_DEFAULTS, startLocation: 100 }).content,
    );
    expect(rows[1][0]).toBe("100");
    expect(rows[2][0]).toBe("101");
  });

  it("truncates Name and warns", () => {
    const ch = makeChannel({
      rx_frequency: 145.5,
      generated_name_final: "ABCDEFGHIJKLMNOP",
    });
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([ch], { ...NICSURE_RT880_DEFAULTS, maxLength: 6 }).content,
    );
    expect(rows[1][2]).toBe("ABCDEF");
    const { warnings } = toNicsureRows([ch], { ...NICSURE_RT880_DEFAULTS, maxLength: 6 });
    expect(warnings.some((w) => w.code === "vgc_title_truncated")).toBe(true);
  });

  it("slot mapping: country / district / type / pack category", () => {
    const sm6 = makeChannel({
      rx_frequency: 145.6,
      district: "6",
      type: "Repeater",
    });
    const la = makeChannel({
      rx_frequency: 145.6,
      district: "LA",
      type: "Link",
    });
    const pack = makeChannel({
      source_type: "channel_pack",
      rx_frequency: 446.0,
      duplex: "",
      tx_frequency: 446.0,
      district: "",
      type: "",
      category: "pmr",
    });
    const rows = parseRows(NICSURE_RT880_TARGET.export([sm6, la, pack], NICSURE_RT880_DEFAULTS).content);
    // Slot1..Slot4 are columns 8..11
    expect(rows[1].slice(8, 12)).toEqual(["S", "6", "R", " "]);
    expect(rows[2].slice(8, 12)).toEqual(["N", " ", "L", " "]);
    expect(rows[3].slice(8, 12)).toEqual([" ", " ", " ", "P"]);
  });

  it("slot toggles can blank individual slots", () => {
    const ch = makeChannel({ rx_frequency: 145.6, district: "6", type: "Repeater" });
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([ch], {
        ...NICSURE_RT880_DEFAULTS,
        slotCountry: false,
        slotType: false,
      }).content,
    );
    expect(rows[1].slice(8, 12)).toEqual([" ", "6", " ", " "]);
  });

  it("emits TX_Power from settings and default fields", () => {
    const ch = makeChannel({ rx_frequency: 145.6 });
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([ch], { ...NICSURE_RT880_DEFAULTS, defaultPower: "Low" }).content,
    );
    expect(rows[1][7]).toBe("Low");
    expect(rows[1][14]).toBe("False"); // BusyLock
    expect(rows[1][15]).toBe("False"); // Reversed
    expect(rows[1][16]).toBe("Off");   // PTTID
    expect(rows[1][17]).toBe("0.00");  // Clarifier
    expect(rows[1][18]).toBe("Off");   // Scrambler
  });
});
