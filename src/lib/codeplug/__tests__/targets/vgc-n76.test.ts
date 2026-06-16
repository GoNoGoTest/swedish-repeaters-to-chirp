import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import { VGC_N76_TARGET, VGC_N76_DEFAULTS, VGC_N76_COLUMNS, toVgcN76Rows } from "@/lib/codeplug/targets/vgc-n76";
import { makeChannel } from "../helpers";

describe("targets/vgc-n76", () => {
  it("metadata: id, label, vendor, extension, limits", () => {
    expect(VGC_N76_TARGET.id).toBe("vgc-n76");
    expect(VGC_N76_TARGET.vendor).toBe("VGC");
    expect(VGC_N76_TARGET.fileExtension).toBe("csv");
    expect(VGC_N76_TARGET.limits.maxChannelsPerGroup).toBe(32);
    expect(VGC_N76_TARGET.limits.maxNameLength).toBe(8);
  });

  it("header row matches the exact VGC app spec", () => {
    const out = VGC_N76_TARGET.export([], VGC_N76_DEFAULTS);
    const header = out.content.split(/\r?\n/)[0];
    expect(header).toBe(VGC_N76_COLUMNS.join(","));
  });

  it("derives mobile tx_freq from rx + tx_shift (negative shift)", () => {
    const ch = makeChannel({
      generated_name_final: "TEST",
      rx_frequency: 145.725,
      tx_shift: -0.6,
      duplex: "-",
      offset: 0.6,
      is_analog_fm: true,
    });
    const out = VGC_N76_TARGET.export([ch], VGC_N76_DEFAULTS);
    const parsed = Papa.parse<string[]>(out.content, { skipEmptyLines: true });
    const row = parsed.data[1]; // [header, row]
    expect(row[1]).toBe("145125000"); // tx_freq = mobile TX
    expect(row[2]).toBe("145725000"); // rx_freq = mobile RX
    expect(row[6]).toBe("12500");     // NFM default
    expect(row[5]).toBe("H");         // default power
  });

  it("encodes CTCSS as Hz×100 on the correct side (SK6BA TX-access tone)", () => {
    // SK6BA-style: ctcss_tx is the tone we transmit to access the repeater.
    // No rx tone → rx_sub=0.
    const ch = makeChannel({
      generated_name_final: "CTCSS",
      rx_frequency: 145.6,
      tx_shift: -0.6,
      duplex: "-",
      offset: 0.6,
      ctcss_tx: 114.8,
      is_analog_fm: true,
    });
    const out = VGC_N76_TARGET.export([ch], VGC_N76_DEFAULTS);
    const row = Papa.parse<string[]>(out.content, { skipEmptyLines: true }).data[1];
    expect(row[3]).toBe("11480"); // tx_sub CTCSS = 114.8 × 100
    expect(row[4]).toBe("0");     // rx_sub none
  });

  it("encodes DCS as decimal of the octal code (both sides)", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "DCS",
      rx_frequency: 145.5555,
      tx_frequency: 145.5555,
      duplex: "",
      dtcs_code: "731",
      dtcs_polarity: "NN",
      tone_raw: "DTCS",
      is_analog_fm: true,
    });
    const out = VGC_N76_TARGET.export([ch], VGC_N76_DEFAULTS);
    const row = Papa.parse<string[]>(out.content, { skipEmptyLines: true }).data[1];
    expect(row[3]).toBe("731");
    expect(row[4]).toBe("731");
  });

  it("warns when DCS polarity is non-NN", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      dtcs_code: "023",
      dtcs_polarity: "NI",
      tone_raw: "DTCS",
    });
    const { warnings } = toVgcN76Rows([ch], VGC_N76_DEFAULTS);
    expect(warnings.filter((w) => w.code === "vgc_dcs_polarity_lost")).toHaveLength(1);
  });

  it("warns once when channel count exceeds channelsPerGroup", () => {
    const channels = Array.from({ length: 33 }, () => makeChannel({ generated_name_final: "X" }));
    const { warnings } = toVgcN76Rows(channels, VGC_N76_DEFAULTS);
    expect(warnings.filter((w) => w.code === "vgc_over_group_limit")).toHaveLength(1);
  });

  it("truncates title beyond maxLength and warns", () => {
    const ch = makeChannel({ generated_name_final: "ABCDEFGHIJKLMNOPQ" }); // 17 chars
    const { rows, warnings } = toVgcN76Rows([ch], VGC_N76_DEFAULTS);
    expect(rows[0].title).toBe("ABCDEFGH"); // 8
    expect(warnings.filter((w) => w.code === "vgc_title_truncated")).toHaveLength(1);
  });

  it("maps mode_chirp NFM/FM to 12500/25000 bandwidth", () => {
    const nfm = makeChannel({ source_type: "channel_pack", mode_chirp: "NFM", rx_frequency: 144.5, tx_frequency: 144.5 });
    const fm = makeChannel({ source_type: "channel_pack", mode_chirp: "FM",  rx_frequency: 144.5, tx_frequency: 144.5 });
    const out = VGC_N76_TARGET.export([nfm, fm], VGC_N76_DEFAULTS);
    const rows = Papa.parse<string[]>(out.content, { skipEmptyLines: true }).data;
    expect(rows[1][6]).toBe("12500");
    expect(rows[2][6]).toBe("25000");
  });

  it("flags RX-only channels via tx_dis", () => {
    const ch = makeChannel({ source_type: "channel_pack", rx_only: true, tx_allowed: false, rx_frequency: 161.0, tx_frequency: 161.0 });
    const out = VGC_N76_TARGET.export([ch], VGC_N76_DEFAULTS);
    const row = Papa.parse<string[]>(out.content, { skipEmptyLines: true }).data[1];
    expect(row[11]).toBe("1"); // tx_dis
  });

  it("pads to padToChannels with empty rows", () => {
    const ch = makeChannel({ generated_name_final: "ONE", rx_frequency: 145.5 });
    const out = VGC_N76_TARGET.export([ch], { ...VGC_N76_DEFAULTS, padToChannels: 4 });
    const data = Papa.parse<string[]>(out.content, { skipEmptyLines: false }).data;
    // header + 1 real + 3 empty (papaparse may emit trailing empty token line)
    expect(data.length).toBeGreaterThanOrEqual(5);
    expect(data[1][0]).toBe("ONE");
    expect(data[4][1]).toBe(""); // empty tx_freq on padded row
  });

  it("skip_raw=S sets scan=0", () => {
    const ch = makeChannel({ generated_name_final: "SKIP", skip_raw: "S" });
    const out = VGC_N76_TARGET.export([ch], VGC_N76_DEFAULTS);
    const row = Papa.parse<string[]>(out.content, { skipEmptyLines: true }).data[1];
    expect(row[7]).toBe("0");
  });

  it("validate() returns same warnings as export()", () => {
    const channels = Array.from({ length: 33 }, () => makeChannel({ generated_name_final: "X" }));
    const exportWarnings = VGC_N76_TARGET.export(channels, VGC_N76_DEFAULTS).warnings;
    const validateWarnings = VGC_N76_TARGET.validate!(channels, VGC_N76_DEFAULTS);
    expect(validateWarnings).toEqual(exportWarnings);
  });

  it("AM channel: rx_mod=1, tx_mod=1, bandwidth=25000, no unsupported warning", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "AIR",
      mode_chirp: "AM",
      rx_frequency: 121.5,
      tx_frequency: 121.5,
      rx_only: true,
      tx_allowed: false,
    });
    const { rows, warnings } = toVgcN76Rows([ch], VGC_N76_DEFAULTS);
    expect(rows[0].rx_mod).toBe("1");
    expect(rows[0].tx_mod).toBe("1");
    expect(rows[0].bandwidth).toBe("25000");
    expect(rows[0].tx_dis).toBe("1");
    expect(warnings.filter((w) => w.code === "vgc_unsupported_mode")).toHaveLength(0);
  });

  it("USB still triggers unsupported_mode warning (AM removed from list)", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "SSB",
      mode_chirp: "USB",
      rx_frequency: 14.2,
      tx_frequency: 14.2,
    });
    const { warnings } = toVgcN76Rows([ch], VGC_N76_DEFAULTS);
    const w = warnings.find((w) => w.code === "vgc_unsupported_mode");
    expect(w).toBeDefined();
    expect(w!.message).not.toMatch(/AM/);
  });
});
