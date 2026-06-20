import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  NICSURE_RT880_TARGET,
  NICSURE_RT880_DEFAULTS,
  NICSURE_RT880_COLUMNS,
  toNicsureRows,
  buildZoneLegend,
  formatZoneLegend,
  type NicsureZoneDimensionId,
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
    expect(row[3]).toBe("145.72500");
    expect(row[4]).toBe("145.12500");
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
    expect(row[5]).toBe("None");
    expect(row[6]).toBe("67.0");
  });

  it("encodes DCS as D<3-digit><polarity letter> per side", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "DCS",
      rx_frequency: 462.7,
      tx_frequency: 462.7,
      duplex: "",
      dtcs_code: "51",
      dtcs_polarity: "NR",
      tone_raw: "DTCS",
    });
    const row = parseRows(NICSURE_RT880_TARGET.export([ch], NICSURE_RT880_DEFAULTS).content)[1];
    expect(row[5]).toBe("D051I");
    expect(row[6]).toBe("D051N");
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

  it("assigns A–Z per dimension from a shared global pool, alphabetically", () => {
    const se6 = makeChannel({ district: "6", type: "Repeater" });
    const se7 = makeChannel({ district: "7", type: "Repeater" });
    const no = makeChannel({ district: "LA", type: "Link" });
    const legend = buildZoneLegend([se6, se7, no], ["country", "district", "type"]);

    // country: NO, SE → A, B
    expect(legend.slots[0].entries).toEqual([
      { letter: "A", value: "NO" },
      { letter: "B", value: "SE" },
    ]);
    // district: LA, SM6, SM7 → next letters from the shared pool: C, D, E
    expect(legend.slots[1].entries).toEqual([
      { letter: "C", value: "LA" },
      { letter: "D", value: "SM6" },
      { letter: "E", value: "SM7" },
    ]);
    // type: Link, Repeater → F, G
    expect(legend.slots[2].entries).toEqual([
      { letter: "F", value: "Link" },
      { letter: "G", value: "Repeater" },
    ]);
  });

  it("writes the assigned letters into Slot1..Slot4 in dimension order", () => {
    const se6 = makeChannel({ district: "6", type: "Repeater" });
    const no = makeChannel({ district: "LA", type: "Link" });
    const rows = parseRows(NICSURE_RT880_TARGET.export([se6, no], NICSURE_RT880_DEFAULTS).content);
    // 4 default dims; with these two channels: country (NO=A,SE=B), district (LA=C,SM6=D), type (Link=E,Repeater=F), category (none).
    expect(rows[1].slice(8, 12)).toEqual(["B", "D", "F", " "]);
    expect(rows[2].slice(8, 12)).toEqual(["A", "C", "E", " "]);
  });

  it("missing value for a dimension writes a blank slot", () => {
    const noType = makeChannel({ district: "6", type: "" });
    const legend = buildZoneLegend([noType], ["country", "type"]);
    expect(legend.slots[0].entries).toEqual([{ letter: "A", value: "SE" }]);
    expect(legend.slots[1].entries).toEqual([]);
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([noType], {
        ...NICSURE_RT880_DEFAULTS,
        zoneDimensions: ["country", "type"],
      }).content,
    );
    expect(rows[1].slice(8, 12)).toEqual(["A", " ", " ", " "]);
  });

  it("district dimension falls back to pack_id for channel-pack rows", () => {
    const rpt = makeChannel({ district: "6", type: "Repeater" });
    const pack = makeChannel({
      source_type: "channel_pack",
      district: "",
      type: "",
      pack_id: "se_marine_vhf",
      rx_frequency: 156.05,
    });
    const legend = buildZoneLegend([rpt, pack], ["district"]);
    expect(legend.slots[0].entries).toEqual([
      { letter: "A", value: "se_marine_vhf" },
      { letter: "B", value: "SM6" },
    ]);
  });



  it("zoneDimensions: [] leaves every slot blank", () => {
    const ch = makeChannel({ district: "6", type: "Repeater" });
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([ch], { ...NICSURE_RT880_DEFAULTS, zoneDimensions: [] }).content,
    );
    expect(rows[1].slice(8, 12)).toEqual([" ", " ", " ", " "]);
  });

  it("emits a warning and overflow when more than 26 unique values exist", () => {
    const chs = Array.from({ length: 30 }, (_, i) =>
      makeChannel({ rx_frequency: 145 + i / 1000, type: `T${String(i).padStart(2, "0")}` }),
    );
    const { warnings, legend } = toNicsureRows(chs, {
      ...NICSURE_RT880_DEFAULTS,
      zoneDimensions: ["type"],
    });
    expect(warnings.some((w) => w.code === "nicsure_zone_pool_exhausted")).toBe(true);
    expect(legend.slots[0].entries.length).toBe(26);
    expect(legend.slots[0].overflow.length).toBe(4);
  });

  it("formatZoneLegend renders a readable text block", () => {
    const se6 = makeChannel({ district: "6", type: "Repeater" });
    const no = makeChannel({ district: "LA", type: "Link" });
    const text = formatZoneLegend(
      buildZoneLegend([se6, no], ["country", "type"] as NicsureZoneDimensionId[]),
    );
    expect(text).toContain("Slot1 — Land");
    expect(text).toContain("A = NO");
    expect(text).toContain("B = SE");
    expect(text).toContain("Slot2 — Kanaltyp");
    expect(text).toContain("C = Link");
    expect(text).toContain("D = Repeater");
  });

  it("emits TX_Power from settings and default fields", () => {
    const ch = makeChannel({ rx_frequency: 145.6 });
    const rows = parseRows(
      NICSURE_RT880_TARGET.export([ch], { ...NICSURE_RT880_DEFAULTS, defaultPower: "Low" }).content,
    );
    expect(rows[1][7]).toBe("Low");
    expect(rows[1][14]).toBe("False");
    expect(rows[1][15]).toBe("False");
    expect(rows[1][16]).toBe("Off");
    expect(rows[1][17]).toBe("0.00");
    expect(rows[1][18]).toBe("Off");
  });

  it("duplex=off writes TX=0.00000 and emits nicsure_tx_block_unsupported warning", () => {
    const ch = makeChannel({ generated_name_final: "RX", rx_frequency: 161.0, duplex: "off" });
    const out = NICSURE_RT880_TARGET.export([ch], NICSURE_RT880_DEFAULTS);
    const row = parseRows(out.content)[1];
    expect(row[4]).toBe("0.00000");
    expect(out.warnings.some((w) => w.code === "nicsure_tx_block_unsupported")).toBe(true);
  });
});
