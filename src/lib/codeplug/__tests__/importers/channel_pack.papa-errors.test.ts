import { describe, it, expect } from "vitest";
import { parseChannelPackCsv } from "../../importers/channel_pack";

const HEADER =
  "pack_id,source_id,enabled_default,service,band,category,tags,type,label,channel," +
  "name_hint,rx_frequency,tx_frequency,duplex,offset,mode,tstep,tone,rtone_freq,ctone_freq," +
  "dtcs_code,dtcs_polarity,skip,tx_allowed,rx_only,license_note,comment,source,source_url,inferred_from_range";

describe("parseChannelPackCsv parse error surfacing", () => {
  it("rapporterar Papa-fel som strukturerade parseWarnings men returnerar kanaler", () => {
    const good = `pack_a,ch1,true,marine,2m,cat,,Repeater,Lbl,M01,N1,145.500,,,,FM,,,,,,,,,,,,,,`;
    const bad = `pack_a,ch2,true`;
    const csv = `${HEADER}\n${good}\n${bad}`;
    const r = parseChannelPackCsv(csv, "test.csv");
    expect(r.parseWarnings.length).toBeGreaterThan(0);
    const w = r.parseWarnings[0];
    expect(w.source).toBe("papa");
    expect(typeof w.row === "number" || w.row === null).toBe(true);
    expect(r.channels.length).toBe(2);
  });

  it("ingen parseWarnings när alla rader är välformade", () => {
    const good = `pack_a,ch1,true,marine,2m,cat,,Repeater,Lbl,M01,N1,145.500,,,,FM,,,,,,,,,,,,,,`;
    const csv = `${HEADER}\n${good}`;
    const r = parseChannelPackCsv(csv, "test.csv");
    expect(r.parseWarnings).toEqual([]);
  });

  it("schema-fel pekar ut kolumnen via column-fältet", () => {
    const bad = `pack_a,ch1,true,marine,2m,cat,,Repeater,Lbl,M01,N1,145.500,,banana,,FM,,,,,,,,,,,,,,`;
    const csv = `${HEADER}\n${bad}`;
    const r = parseChannelPackCsv(csv, "test.csv");
    const schema = r.parseWarnings.find((w) => w.source === "schema");
    expect(schema).toBeDefined();
    expect(schema?.column).toBe("duplex");
  });
});
