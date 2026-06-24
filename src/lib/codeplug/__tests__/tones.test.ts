import { describe, it, expect } from "vitest";
import { parseAccess, parseDigitalAccess } from "../tones";

describe("parseAccess", () => {
  it("returns null/false for empty", () => {
    expect(parseAccess("")).toEqual({ ctcss: null, uses1750: false, carrier: false, dcs: null });
    expect(parseAccess(null)).toEqual({ ctcss: null, uses1750: false, carrier: false, dcs: null });
  });

  it("detects 1750 separately from ctcss", () => {
    const r = parseAccess("1750");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeNull();
    expect(r.carrier).toBe(false);
  });

  it("extracts CTCSS in valid range", () => {
    const r = parseAccess("123.0");
    expect(r.ctcss).toBeCloseTo(123.0);
    expect(r.uses1750).toBe(false);
    expect(r.carrier).toBe(false);
  });

  it("handles mixed access with 1750 and ctcss", () => {
    const r = parseAccess("1750/123.0");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeCloseTo(123.0);
  });

  it("ignores out-of-range numbers", () => {
    const r = parseAccess("9999");
    expect(r.ctcss).toBeNull();
    expect(r.uses1750).toBe(false);
  });

  it("splits on common delimiters", () => {
    expect(parseAccess("88.5 1750").uses1750).toBe(true);
    expect(parseAccess("88.5;1750").ctcss).toBeCloseTo(88.5);
    expect(parseAccess("88.5|1750").ctcss).toBeCloseTo(88.5);
  });

  it("preserves decimal comma in access (e.g. '1750 / 156,7 / DTMF 6')", () => {
    const r = parseAccess("1750 / 156,7 / DTMF 6");
    expect(r.uses1750).toBe(true);
    expect(r.ctcss).toBeCloseTo(156.7);
  });

  it("recognises 'Carrier' as explicit no-tone access", () => {
    const r = parseAccess("Carrier");
    expect(r.carrier).toBe(true);
    expect(r.ctcss).toBeNull();
    expect(r.uses1750).toBe(false);
  });

  it("recognises carrier alongside 1750", () => {
    const r = parseAccess("1750/Carrier");
    expect(r.carrier).toBe(true);
    expect(r.uses1750).toBe(true);
  });

  it("recognises common no-tone synonyms", () => {
    expect(parseAccess("open").carrier).toBe(true);
    expect(parseAccess("none").carrier).toBe(true);
    expect(parseAccess("ingen").carrier).toBe(true);
  });

  it("recognises 'no tone' (whitespace-separated) as carrier", () => {
    expect(parseAccess("no tone").carrier).toBe(true);
    expect(parseAccess("NO TONE").carrier).toBe(true);
    expect(parseAccess("notone").carrier).toBe(true);
  });

  describe("DCS/DTCS", () => {
    it("parses 'DCS 025' as dcs=025", () => {
      const r = parseAccess("DCS 025");
      expect(r.dcs).toBe("025");
      expect(r.ctcss).toBeNull();
    });
    it("parses inline forms DCS025/DTCS025/DTCS 025", () => {
      expect(parseAccess("DCS025").dcs).toBe("025");
      expect(parseAccess("DTCS025").dcs).toBe("025");
      expect(parseAccess("DTCS 025").dcs).toBe("025");
    });
    it("parses short form D025", () => {
      expect(parseAccess("D025").dcs).toBe("025");
    });
    it("normalises 'DCS 25' to '025'", () => {
      expect(parseAccess("DCS 25").dcs).toBe("025");
    });
    it("does not treat bare '25' as DCS", () => {
      expect(parseAccess("25").dcs).toBeNull();
    });
    it("combines 1750 and DCS", () => {
      const r = parseAccess("1750/DCS 025");
      expect(r.uses1750).toBe(true);
      expect(r.dcs).toBe("025");
    });
    it("captures both CTCSS and DCS when present", () => {
      const r = parseAccess("123.0/DCS 025");
      expect(r.ctcss).toBeCloseTo(123.0);
      expect(r.dcs).toBe("025");
    });
    it("avvisar icke-oktala DCS-värden (digits 8/9)", () => {
      // DCS-koder är 3-siffriga oktala värden; 089 och 800 är inte giltiga.
      expect(parseAccess("DCS 089").dcs).toBeNull();
      expect(parseAccess("DCS 800").dcs).toBeNull();
      expect(parseAccess("DCS 999").dcs).toBeNull();
    });
  });
});

describe("parseDigitalAccess", () => {
  it("returns empty for empty input", () => {
    const r = parseDigitalAccess("");
    expect(r.dmr.colorCode).toBeNull();
    expect(r.dmr.timeSlot).toBeNull();
    expect(r.dmr.talkGroup).toBe("");
    expect(r.c4fm.dgIdTx).toBeNull();
    expect(r.c4fm.dgIdRx).toBeNull();
    expect(r.p25.nac).toBe("");
    expect(r.unknownTokens).toEqual([]);
  });

  describe("DMR", () => {
    it("parses CC variants (CC6, CC 1, CC=1, CC06)", () => {
      expect(parseDigitalAccess("CC6").dmr.colorCode).toBe(6);
      expect(parseDigitalAccess("CC 1").dmr.colorCode).toBe(1);
      expect(parseDigitalAccess("CC=1").dmr.colorCode).toBe(1);
      expect(parseDigitalAccess("CC06").dmr.colorCode).toBe(6);
    });
    it("parses TS variants", () => {
      expect(parseDigitalAccess("TS2").dmr.timeSlot).toBe(2);
      expect(parseDigitalAccess("TS=2").dmr.timeSlot).toBe(2);
    });
    it("parses TG variants", () => {
      expect(parseDigitalAccess("TG91").dmr.talkGroup).toBe("91");
      expect(parseDigitalAccess("TG=240").dmr.talkGroup).toBe("240");
    });
  });

  describe("C4FM", () => {
    it("parses TX/RX in three forms", () => {
      expect(parseDigitalAccess("TX00").c4fm.dgIdTx).toBe(0);
      expect(parseDigitalAccess("TX 00").c4fm.dgIdTx).toBe(0);
      expect(parseDigitalAccess("TX=00").c4fm.dgIdTx).toBe(0);
      expect(parseDigitalAccess("RX12").c4fm.dgIdRx).toBe(12);
      expect(parseDigitalAccess("RX 12").c4fm.dgIdRx).toBe(12);
      expect(parseDigitalAccess("RX=12").c4fm.dgIdRx).toBe(12);
    });
  });

  describe("P25", () => {
    it("parses NAC in three forms (hex 3 digits)", () => {
      expect(parseDigitalAccess("NAC293").p25.nac).toBe("293");
      expect(parseDigitalAccess("NAC 293").p25.nac).toBe("293");
      expect(parseDigitalAccess("NAC=293").p25.nac).toBe("293");
      expect(parseDigitalAccess("nacABC").p25.nac).toBe("ABC");
    });
  });

  it("mixed analog + digital: 123.0 / CC 1 → CC=1, no unknowns", () => {
    const r = parseDigitalAccess("123.0 / CC 1");
    expect(r.dmr.colorCode).toBe(1);
    expect(r.unknownTokens).toEqual([]);
  });

  it("does not flag analog-consumable tokens as unknown", () => {
    const cases = [
      "123.0",
      "1750",
      "DCS023",
      "DTCS 025",
      "D025",
      "carrier",
      "open",
      "none",
      "ingen",
      "no tone",
    ];
    for (const s of cases) {
      const r = parseDigitalAccess(s);
      expect(r.unknownTokens, `case=${s}`).toEqual([]);
    }
  });

  it("flags truly unknown fragments", () => {
    const r = parseDigitalAccess("XYZ42");
    expect(r.unknownTokens).toEqual(["XYZ42"]);
  });

  describe("invalid digital tokens land in unknownTokens", () => {
    it("CC99 out of range → unknownTokens, colorCode null", () => {
      const r = parseDigitalAccess("CC99");
      expect(r.dmr.colorCode).toBeNull();
      expect(r.unknownTokens).toContain("CC99");
    });
    it("TS3 invalid timeslot → unknownTokens, timeSlot null", () => {
      const r = parseDigitalAccess("TS3");
      expect(r.dmr.timeSlot).toBeNull();
      expect(r.unknownTokens).toContain("TS3");
    });
    it("NACZZZ doesn't match strict regex → falls into unknownTokens via tokenizer", () => {
      const r = parseDigitalAccess("NACZZZ");
      expect(r.p25.nac).toBe("");
      expect(r.unknownTokens).toContain("NACZZZ");
    });
  });
});
