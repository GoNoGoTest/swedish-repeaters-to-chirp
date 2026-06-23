import { describe, it, expect } from "vitest";
import { exportChirpCsv, toChirpRows, CHIRP_COLUMNS } from "../../exporters/chirp";
import { DEFAULT_SETTINGS } from "../../defaults";
import { makeChannel } from "../helpers";

import { CHIRP_GENERIC_DEFAULTS } from "@/lib/codeplug/targets";
const chirp = CHIRP_GENERIC_DEFAULTS;

const EXPECTED_HEADER =
  "Location,Name,Frequency,Duplex,Offset,Tone,rToneFreq,cToneFreq,DtcsCode,DtcsPolarity,RxDtcsCode,CrossMode,Mode,TStep,Skip,Power,Comment,URCALL,RPT1CALL,RPT2CALL,DVCODE";

describe("CHIRP exporter", () => {
  it("emits the RMS/CHIRP-compatible header (Power before Comment, no DVCODE)", () => {
    const csv = exportChirpCsv([], chirp);
    const header = csv.split(/\r?\n/)[0];
    expect(header).toBe(EXPECTED_HEADER);
    expect(CHIRP_COLUMNS[CHIRP_COLUMNS.length - 1]).toBe("DVCODE");
    expect(CHIRP_COLUMNS.indexOf("Power")).toBeLessThan(CHIRP_COLUMNS.indexOf("Comment"));
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

  it("uses pack mode_pack when present, fallback to settings.mode otherwise", () => {
    const sk = makeChannel({ generated_name_final: "X" });
    const pack = makeChannel({ source_type: "channel_pack", generated_name_final: "Y", mode_pack: "USB" });
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

  it("includes Power default of 10.0W", () => {
    const c = makeChannel({ generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Power).toBe("10.0W");
  });

  it("sets Tone when ctcss_tx present, with numeric defaults in unused tone fields", () => {
    const c = makeChannel({ generated_name_final: "X", ctcss_tx: 123.0 });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Tone");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].cToneFreq).toBe("88.5");
    expect(rows[0].DtcsCode).toBe("023");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].RxDtcsCode).toBe("023");
    expect(rows[0].CrossMode).toBe("Tone->");
  });

  it("SK6BA without any tone leaves Tone empty but writes numeric defaults", () => {
    const c = makeChannel({ generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("");
    expect(rows[0].rToneFreq).toBe("88.5");
    expect(rows[0].cToneFreq).toBe("88.5");
    expect(rows[0].DtcsCode).toBe("023");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].RxDtcsCode).toBe("023");
    expect(rows[0].CrossMode).toBe("Tone->");
  });

  it("pack with tone=TSQL fills rTone and cTone", () => {
    const c = makeChannel({
      source_type: "channel_pack", generated_name_final: "X",
      tone_raw: "TSQL", rtone_freq: 123.0, ctone_freq: 123.0,
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("TSQL");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].cToneFreq).toBe("123.0");
    expect(rows[0].DtcsCode).toBe("023");
  });

  it("pack with tone=DTCS fills only DTCS fields, defaults on tone freqs", () => {
    const c = makeChannel({
      source_type: "channel_pack", generated_name_final: "X",
      tone_raw: "DTCS", dtcs_code: "411", dtcs_polarity: "NN",
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("DTCS");
    expect(rows[0].DtcsCode).toBe("411");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].rToneFreq).toBe("88.5");
    expect(rows[0].cToneFreq).toBe("88.5");
  });

  it("pack with empty tone leaves Tone empty but writes numeric defaults", () => {
    const c = makeChannel({ source_type: "channel_pack", generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("");
    expect(rows[0].rToneFreq).toBe("88.5");
    expect(rows[0].cToneFreq).toBe("88.5");
  });

  it("SK6BA with DCS access exports as Cross + DTCS-> with numeric tone defaults", () => {
    const c = makeChannel({ generated_name_final: "X", dtcs_code: "025", dtcs_polarity: "NN" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Cross");
    expect(rows[0].DtcsCode).toBe("025");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].CrossMode).toBe("DTCS->");
    expect(rows[0].rToneFreq).toBe("88.5");
    expect(rows[0].cToneFreq).toBe("88.5");
    expect(rows[0].RxDtcsCode).toBe("023");
  });

  it("SK6BA with both CTCSS and DCS prefers CTCSS", () => {
    const c = makeChannel({ generated_name_final: "X", ctcss_tx: 123.0, dtcs_code: "025", dtcs_polarity: "NN" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Tone");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].DtcsCode).toBe("023");
    expect(rows[0].CrossMode).toBe("Tone->");
  });

  it("never produces empty rToneFreq, cToneFreq, DtcsCode, DtcsPolarity, RxDtcsCode or CrossMode", () => {
    const channels = [
      makeChannel({ generated_name_final: "A" }),
      makeChannel({ generated_name_final: "B", ctcss_tx: 77.0 }),
      makeChannel({ generated_name_final: "C", dtcs_code: "025", dtcs_polarity: "NN" }),
      makeChannel({ source_type: "channel_pack", generated_name_final: "D" }),
    ];
    const rows = toChirpRows(channels, chirp);
    for (const r of rows) {
      expect(r.rToneFreq).not.toBe("");
      expect(r.cToneFreq).not.toBe("");
      expect(r.DtcsCode).not.toBe("");
      expect(r.DtcsPolarity).not.toBe("");
      expect(r.RxDtcsCode).not.toBe("");
      expect(r.CrossMode).not.toBe("");
      expect(Number.isFinite(parseFloat(r.rToneFreq))).toBe(true);
      expect(Number.isFinite(parseFloat(r.cToneFreq))).toBe(true);
    }
  });

  describe("mode_effective → CHIRP Mode mapping", () => {
    const cases: Array<[string, string]> = [
      ["C4FM", "DN"],
      ["D-Star", "DV"],
      ["DMR", "DMR"],
      ["DMRplus", "DMR"],
      ["P25", "P25"],
      ["CW", "CW"],
    ];
    for (const [eff, expected] of cases) {
      it(`mode_effective="${eff}" → Mode="${expected}"`, () => {
        const c = makeChannel({ generated_name_final: "X", mode_effective: eff });
        const rows = toChirpRows([c], { ...chirp, mode: "NFM" });
        expect(rows[0].Mode).toBe(expected);
      });
    }

    it("analog FM uses settings.mode fallback (NFM)", () => {
      const c = makeChannel({ generated_name_final: "X", mode_effective: "FM" });
      const rows = toChirpRows([c], { ...chirp, mode: "NFM" });
      expect(rows[0].Mode).toBe("NFM");
    });

    it("analog FM uses settings.mode fallback (FM)", () => {
      const c = makeChannel({ generated_name_final: "X", mode_effective: "FM" });
      const rows = toChirpRows([c], { ...chirp, mode: "FM" });
      expect(rows[0].Mode).toBe("FM");
    });

    it("Tetra falls back to analog settings.mode", () => {
      const c = makeChannel({ generated_name_final: "X", mode_effective: "Tetra" });
      const rows = toChirpRows([c], { ...chirp, mode: "NFM" });
      expect(rows[0].Mode).toBe("NFM");
    });

    it("channel_pack mode_pack overrides effective-mode mapping", () => {
      const c = makeChannel({
        source_type: "channel_pack",
        generated_name_final: "X",
        mode_pack: "USB",
        mode_effective: "C4FM",
      });
      const rows = toChirpRows([c], { ...chirp, mode: "NFM" });
      expect(rows[0].Mode).toBe("USB");
    });
  });

  it("emits DVCODE as empty string for every row", () => {
    const c = makeChannel({ generated_name_final: "X", mode_effective: "C4FM" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].DVCODE).toBe("");
  });
});

