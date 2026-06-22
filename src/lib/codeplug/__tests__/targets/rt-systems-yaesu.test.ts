import { describe, it, expect } from "vitest";
import {
  exportRtSystemsYaesuCsv,
  toRtSystemsYaesuRow,
  RT_SYSTEMS_YAESU_DEFAULTS,
  RT_SYSTEMS_YAESU_HEADER_FIELDS,
} from "../../targets/rt-systems-yaesu";
import { makeChannel } from "../helpers";

const S = RT_SYSTEMS_YAESU_DEFAULTS;

describe("RT Systems Yaesu — header", () => {
  it("emits a 21-field header with a leading and trailing empty column", () => {
    const { csv } = exportRtSystemsYaesuCsv([], S);
    const headerLine = csv.split("\r\n")[0];
    expect(headerLine).toBe(
      ",Receive Frequency,Transmit Frequency,Offset Frequency,Offset Direction,Operating Mode,AMS,Name,Tone Mode,CTCSS,DCS,RX DGID,TX DGID,User CTCSS,Tx Power,Skip,Step,Clock Shift,Memory Group,Comment,",
    );
    expect(RT_SYSTEMS_YAESU_HEADER_FIELDS.length).toBe(21);
  });
});

describe("RT Systems Yaesu — Operating Mode mapping", () => {
  it("FM → Operating Mode 'FM'", () => {
    const ch = makeChannel({
      generated_name_final: "BORAS",
      mode_effective: "FM",
      rx_frequency: 145.6, duplex: "-", offset: 0.6, tx_shift: -0.6,
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[5]).toBe("FM"); // Operating Mode
    expect(fields[3]).toBe("600 kHz"); // Offset Frequency
    expect(fields[4]).toBe("Minus"); // Offset Direction
  });

  it("C4FM → Operating Mode 'DN'", () => {
    const ch = makeChannel({
      generated_name_final: "BORASYSF",
      mode_effective: "C4FM",
      rx_frequency: 145.6, duplex: "-", offset: 0.6, tx_shift: -0.6,
    });
    const { fields, unsupportedMode } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[5]).toBe("DN");
    expect(unsupportedMode).toBe(false);
  });

  it("D-Star falls back to FM and flags unsupported", () => {
    const ch = makeChannel({
      generated_name_final: "DSTAR",
      mode_effective: "D-Star",
      rx_frequency: 434.6, duplex: "-", offset: 2, tx_shift: -2,
    });
    const { fields, unsupportedMode } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[5]).toBe("FM");
    expect(unsupportedMode).toBe(true);
  });

  it("emits the rt_unsupported_mode warning when any row is unsupported", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "DMR",
      rx_frequency: 145.6, duplex: "-", offset: 0.6,
    });
    const { warnings } = exportRtSystemsYaesuCsv([ch], S);
    expect(warnings.some((w) => w.code === "rt_unsupported_mode")).toBe(true);
  });
});

describe("RT Systems Yaesu — offset / simplex", () => {
  it("simplex rows write empty offset and Direction='Simplex'", () => {
    const ch = makeChannel({
      generated_name_final: "S20",
      mode_effective: "FM",
      rx_frequency: 145.5, duplex: "", offset: 0, tx_shift: 0,
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[3]).toBe(""); // Offset Frequency
    expect(fields[4]).toBe("Simplex");
    expect(fields[1]).toBe("145.50000");
    expect(fields[2]).toBe("145.50000"); // Transmit = Receive for simplex
  });

  it("plus-shift renders 'Plus' direction", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "FM",
      rx_frequency: 433.0, duplex: "+", offset: 1.6, tx_shift: 1.6,
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[4]).toBe("Plus");
    expect(fields[3]).toBe("1600 kHz");
  });
});

describe("RT Systems Yaesu — Tone Mode", () => {
  it("CTCSS-TX → Tone Mode='Tone' and CTCSS value", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "FM",
      rx_frequency: 145.6, duplex: "-", offset: 0.6, ctcss_tx: 88.5,
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[8]).toBe("Tone");
    expect(fields[9]).toBe("88.5");
  });

  it("DCS code → Tone Mode='DCS' and 3-digit DCS", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "FM",
      rx_frequency: 145.6, duplex: "-", offset: 0.6,
      dtcs_code: "25", dtcs_polarity: "NN",
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[8]).toBe("DCS");
    expect(fields[10]).toBe("025");
  });

  it("No tone info → Tone Mode='None' with default CTCSS/DCS placeholders", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "FM",
      rx_frequency: 145.5, duplex: "",
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[8]).toBe("None");
    expect(fields[9]).toBe("100.0");
    expect(fields[10]).toBe("023");
  });
});

describe("RT Systems Yaesu — Name truncation", () => {
  it("truncates names over maxLength and emits warning", () => {
    const ch = makeChannel({
      generated_name_final: "THIS_IS_WAY_TOO_LONG_FOR_THE_RADIO",
      mode_effective: "FM",
      rx_frequency: 145.5, duplex: "",
    });
    const { csv, warnings } = exportRtSystemsYaesuCsv([ch], S);
    expect(warnings.some((w) => w.code === "rt_name_truncated")).toBe(true);
    // Check the row name column (index 7) is truncated to 16 chars
    const row = csv.split("\r\n")[1];
    const cells = row.split(",");
    expect(cells[7].length).toBeLessThanOrEqual(S.maxLength);
  });
});

describe("RT Systems Yaesu — Skip column", () => {
  it("scans by default", () => {
    const ch = makeChannel({
      generated_name_final: "X", mode_effective: "FM",
      rx_frequency: 145.5, duplex: "",
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, S);
    expect(fields[15]).toBe("Scan");
  });

  it("skipLinks=true marks Link rows as Skip", () => {
    const ch = makeChannel({
      generated_name_final: "X", type: "Link", mode_effective: "FM",
      rx_frequency: 145.5, duplex: "",
    });
    const { fields } = toRtSystemsYaesuRow(ch, 1, { ...S, skipLinks: true });
    expect(fields[15]).toBe("Skip");
  });
});
