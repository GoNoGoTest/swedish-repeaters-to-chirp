import { describe, it, expect } from "vitest";
import { exportChirpCsv, toChirpRows, CHIRP_COLUMNS } from "../../exporters/chirp";
import { DEFAULT_SETTINGS } from "../../defaults";
import { makeChannel } from "../helpers";

const chirp = DEFAULT_SETTINGS.chirp;

describe("CHIRP exporter", () => {
  it("emits header with CHIRP columns", () => {
    const csv = exportChirpCsv([], chirp);
    expect(csv.split(/\r?\n/)[0]).toBe(CHIRP_COLUMNS.join(","));
  });

  it("formats frequency to 6 decimals and sets Location starting at startLocation", () => {
    const c1 = makeChannel({ generated_name_final: "BORAS", rx_frequency: 145.6, duplex: "-", offset: 0.6 });
    const c2 = makeChannel({ generated_name_final: "SKENE", rx_frequency: 434.6, duplex: "-", offset: 2.0 });
    const rows = toChirpRows([c1, c2], { ...chirp, startLocation: 10 });
    expect(rows[0].Location).toBe("10");
    expect(rows[1].Location).toBe("11");
    expect(rows[0].Frequency).toBe("145.600000");
    expect(rows[0].Duplex).toBe("-");
    expect(rows[0].Offset).toBe("0.600000");
  });

  it("handles split duplex using tx_frequency as offset", () => {
    const c = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "SPLIT",
      rx_frequency: 144.000,
      tx_frequency: 145.000,
      duplex: "split",
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Duplex).toBe("split");
    expect(rows[0].Offset).toBe("145.000000");
  });

  it("uses pack mode_chirp when present, fallback to settings.mode otherwise", () => {
    const sk = makeChannel({ generated_name_final: "X" });
    const pack = makeChannel({ source_type: "channel_pack", generated_name_final: "Y", mode_chirp: "USB" });
    const rows = toChirpRows([sk, pack], { ...chirp, mode: "NFM" });
    expect(rows[0].Mode).toBe("NFM");
    expect(rows[1].Mode).toBe("USB");
  });

  it("merges license_note into Comment for pack rows", () => {
    const c = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "X",
      comment: "ctx",
      license_note: "Cert krävs",
      source: "SSA",
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Comment).toContain("ctx");
    expect(rows[0].Comment).toContain("Cert krävs");
    expect(rows[0].Comment).toContain("src=SSA");
  });

  it("sets Tone when ctcss_tx present", () => {
    const c = makeChannel({ generated_name_final: "X", ctcss_tx: 123.0 });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Tone");
    expect(rows[0].rToneFreq).toBe("123.0");
  });
});
