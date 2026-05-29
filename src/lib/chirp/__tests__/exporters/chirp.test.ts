import { describe, it, expect } from "vitest";
import { exportChirpCsv, toChirpRows, CHIRP_COLUMNS } from "../../exporters/chirp";
import { DEFAULT_SETTINGS } from "../../defaults";
import { makeChannel } from "../helpers";

const chirp = DEFAULT_SETTINGS.chirp;

const EXPECTED_HEADER =
  "Location,Name,Frequency,Duplex,Offset,Tone,rToneFreq,cToneFreq,DtcsCode,DtcsPolarity,RxDtcsCode,CrossMode,Mode,TStep,Skip,Power,Comment,URCALL,RPT1CALL,RPT2CALL";

describe("CHIRP exporter", () => {
  it("emits the RMS/CHIRP-compatible header (Power before Comment, no DVCODE)", () => {
    const csv = exportChirpCsv([], chirp);
    const header = csv.split(/\r?\n/)[0];
    expect(header).toBe(EXPECTED_HEADER);
    expect(CHIRP_COLUMNS).not.toContain("DVCODE");
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

  it("includes Power default of 10.0W", () => {
    const c = makeChannel({ generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Power).toBe("10.0W");
  });

  it("sets Tone when ctcss_tx present, leaves unused tone/DCS fields empty", () => {
    const c = makeChannel({ generated_name_final: "X", ctcss_tx: 123.0 });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Tone");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].cToneFreq).toBe("");
    expect(rows[0].DtcsCode).toBe("");
    expect(rows[0].DtcsPolarity).toBe("");
    expect(rows[0].RxDtcsCode).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("SK6BA without any tone leaves all tone/DCS fields empty", () => {
    const c = makeChannel({ generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("");
    expect(rows[0].rToneFreq).toBe("");
    expect(rows[0].cToneFreq).toBe("");
    expect(rows[0].DtcsCode).toBe("");
    expect(rows[0].DtcsPolarity).toBe("");
    expect(rows[0].RxDtcsCode).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("SK6BA with 1750 only leaves all tone/DCS fields empty", () => {
    const c = makeChannel({ generated_name_final: "X", uses_1750: true });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("");
    expect(rows[0].rToneFreq).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("CTCSS 146.2 and 114.8 only emit Tone + rToneFreq", () => {
    const a = makeChannel({ generated_name_final: "A", ctcss_tx: 146.2 });
    const b = makeChannel({ generated_name_final: "B", ctcss_tx: 114.8 });
    const rows = toChirpRows([a, b], chirp);
    expect(rows[0]).toMatchObject({ Tone: "Tone", rToneFreq: "146.2", cToneFreq: "", DtcsCode: "", DtcsPolarity: "", RxDtcsCode: "", CrossMode: "" });
    expect(rows[1]).toMatchObject({ Tone: "Tone", rToneFreq: "114.8", cToneFreq: "", DtcsCode: "", DtcsPolarity: "", RxDtcsCode: "", CrossMode: "" });
  });

  it("pack with tone=TSQL fills rTone and cTone, leaves DCS empty", () => {
    const c = makeChannel({
      source_type: "channel_pack", generated_name_final: "X",
      tone_raw: "TSQL", rtone_freq: 123.0, ctone_freq: 123.0,
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("TSQL");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].cToneFreq).toBe("123.0");
    expect(rows[0].DtcsCode).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("pack with tone=DTCS fills only DTCS fields, tone freqs empty", () => {
    const c = makeChannel({
      source_type: "channel_pack", generated_name_final: "X",
      tone_raw: "DTCS", dtcs_code: "411", dtcs_polarity: "NN",
    });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("DTCS");
    expect(rows[0].DtcsCode).toBe("411");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].rToneFreq).toBe("");
    expect(rows[0].cToneFreq).toBe("");
    expect(rows[0].RxDtcsCode).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("pack with empty tone leaves all tone/DCS fields empty", () => {
    const c = makeChannel({ source_type: "channel_pack", generated_name_final: "X" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("");
    expect(rows[0].rToneFreq).toBe("");
    expect(rows[0].cToneFreq).toBe("");
    expect(rows[0].DtcsCode).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("SK6BA with DCS access exports as Cross + DTCS->, tone freqs empty", () => {
    const c = makeChannel({ generated_name_final: "X", dtcs_code: "025", dtcs_polarity: "NN" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Cross");
    expect(rows[0].DtcsCode).toBe("025");
    expect(rows[0].DtcsPolarity).toBe("NN");
    expect(rows[0].CrossMode).toBe("DTCS->");
    expect(rows[0].rToneFreq).toBe("");
    expect(rows[0].cToneFreq).toBe("");
    expect(rows[0].RxDtcsCode).toBe("");
  });

  it("SK6BA with both CTCSS and DCS prefers CTCSS, DCS fields empty", () => {
    const c = makeChannel({ generated_name_final: "X", ctcss_tx: 123.0, dtcs_code: "025", dtcs_polarity: "NN" });
    const rows = toChirpRows([c], chirp);
    expect(rows[0].Tone).toBe("Tone");
    expect(rows[0].rToneFreq).toBe("123.0");
    expect(rows[0].DtcsCode).toBe("");
    expect(rows[0].DtcsPolarity).toBe("");
    expect(rows[0].CrossMode).toBe("");
  });

  it("never fills tone/DCS columns with filler defaults (88.5, 023, NN, Tone->)", () => {
    const channels = [
      makeChannel({ generated_name_final: "A" }),
      makeChannel({ generated_name_final: "B", ctcss_tx: 77.0 }),
      makeChannel({ generated_name_final: "C", dtcs_code: "025", dtcs_polarity: "NN" }),
      makeChannel({ source_type: "channel_pack", generated_name_final: "D" }),
    ];
    const rows = toChirpRows(channels, chirp);
    // No-access row: all empty.
    expect(rows[0]).toMatchObject({ Tone: "", rToneFreq: "", cToneFreq: "", DtcsCode: "", DtcsPolarity: "", RxDtcsCode: "", CrossMode: "" });
    // CTCSS-only row: no DCS/cTone filler.
    expect(rows[1]).toMatchObject({ cToneFreq: "", DtcsCode: "", DtcsPolarity: "", RxDtcsCode: "", CrossMode: "" });
    // Pack with no tone: empty.
    expect(rows[3]).toMatchObject({ Tone: "", rToneFreq: "", DtcsCode: "" });
    // Filler values must never appear when Tone is empty.
    for (const r of rows) {
      if (r.Tone === "") {
        expect(r.rToneFreq).not.toBe("88.5");
        expect(r.cToneFreq).not.toBe("88.5");
        expect(r.DtcsCode).not.toBe("023");
        expect(r.RxDtcsCode).not.toBe("023");
        expect(r.CrossMode).not.toBe("Tone->");
      }
    }
  });
});
