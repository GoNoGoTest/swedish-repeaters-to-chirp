import { describe, it, expect } from "vitest";
import { parseChannelPackCsv } from "../../importers/channel_pack";

const HEADER =
  "pack_id,source_id,enabled_default,service,band,category,tags,type,label,channel," +
  "name_hint,rx_frequency,tx_frequency,duplex,offset,mode,tstep,tone,rtone_freq,ctone_freq," +
  "dtcs_code,dtcs_polarity,skip,tx_allowed,rx_only,license_note,comment,source,source_url,inferred_from_range";

describe("parseChannelPackCsv parse error surfacing", () => {
  it("rapporterar Papa-fel som parseWarnings men returnerar fortfarande kanaler", () => {
    // Rad med för få fält (FieldMismatch).
    const good = `pack_a,ch1,true,marine,2m,cat,,Repeater,Lbl,M01,N1,145.500,,,,FM,,,,,,,,,,,,,,`;
    const bad = `pack_a,ch2,true`;
    const csv = `${HEADER}\n${good}\n${bad}`;
    const r = parseChannelPackCsv(csv, "test.csv");
    expect(r.parseWarnings.length).toBeGreaterThan(0);
    // Båda raderna kommer ut — Papa droppar inte rader vid FieldMismatch.
    expect(r.channels.length).toBe(2);
  });

  it("ingen parseWarnings när alla rader är välformade", () => {
    const good = `pack_a,ch1,true,marine,2m,cat,,Repeater,Lbl,M01,N1,145.500,,,,FM,,,,,,,,,,,,,,`;
    const csv = `${HEADER}\n${good}`;
    const r = parseChannelPackCsv(csv, "test.csv");
    expect(r.parseWarnings).toEqual([]);
  });
});
