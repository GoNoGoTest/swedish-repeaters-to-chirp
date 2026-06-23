import { describe, it, expect } from "vitest";
import { runPipeline } from "../pipeline";
import { DEFAULT_SETTINGS } from "../defaults";
import type { Settings } from "../models";
import { makeChannel } from "./helpers";

const baseSettings: Settings = {
  ...DEFAULT_SETTINGS,
  filter: {
    ...DEFAULT_SETTINGS.filter,
    statuses: ["QRV"],
    includeUnknownRegions: true,
    countries: [],
    modes: [],
  },
};

describe("runPipeline mode-medveten access-subset", () => {
  const baseRow: Record<string, string> = {
    id: "1",
    type: "Repeater",
    status: "QRV",
    output: "434.6000",
    tx_shift: "-2",
    band: "70",
    district: "6",
    city: "Borås",
    call: "SK6BA",
    channel: "RV48",
  };

  it("FM/DMR-rad expanderas, FM behåller CTCSS, DMR får dmr_color_code", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "FM / DMR", access: "123.0 / CC 1" }],
      settings: baseSettings,
    });
    const fm = r.channels.find((c) => c.mode_effective === "FM")!;
    const dmr = r.channels.find((c) => c.mode_effective === "DMR")!;
    expect(fm).toBeDefined();
    expect(dmr).toBeDefined();
    expect(fm.ctcss_tx).toBe(123.0);
    expect(fm.dmr_color_code).toBeNull();
    expect(fm.digital_access_raw).toBe("");
    expect(dmr.ctcss_tx).toBeNull();
    expect(dmr.dmr_color_code).toBe(1);
    expect(dmr.digital_access_raw).toBe("123.0 / CC 1");
  });

  it("FM utan access → missing_access_tone, ingen ctcss_and_dcs", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "FM" }],
      settings: baseSettings,
    });
    const codes = r.channels[0].warnings.map((w) => w.code);
    expect(codes).toContain("missing_access_tone");
    expect(codes).not.toContain("ctcss_and_dcs");
  });

  it("FM access=carrier → ingen missing_access_tone", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "FM", access: "carrier" }],
      settings: baseSettings,
    });
    const codes = r.channels[0].warnings.map((w) => w.code);
    expect(codes).not.toContain("missing_access_tone");
    expect(r.channels[0].analog_carrier_open).toBe(true);
  });

  it("FM access='no tone' → ingen missing_access_tone", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "FM", access: "no tone" }],
      settings: baseSettings,
    });
    const codes = r.channels[0].warnings.map((w) => w.code);
    expect(codes).not.toContain("missing_access_tone");
    expect(r.channels[0].analog_carrier_open).toBe(true);
  });

  it("FM med både CTCSS och DCS → ctcss_and_dcs", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "FM", access: "123.0 / DCS 025" }],
      settings: baseSettings,
    });
    const codes = r.channels[0].warnings.map((w) => w.code);
    expect(codes).toContain("ctcss_and_dcs");
  });

  it("DMR utan analog tone får inga access-varningar", () => {
    const r = runPipeline({
      sk6baRows: [{ ...baseRow, mode: "DMR", access: "CC 1" }],
      settings: baseSettings,
    });
    const codes = r.channels[0].warnings.map((w) => w.code);
    expect(codes).not.toContain("missing_access_tone");
    expect(codes).not.toContain("ctcss_and_dcs");
    expect(r.channels[0].ctcss_tx).toBeNull();
    expect(r.channels[0].dmr_color_code).toBe(1);
  });

  it("analog channel-pack-rad utan tone får INTE missing_access_tone", () => {
    const pack = makeChannel({
      source_type: "channel_pack",
      mode_pack: "FM",
      mode_effective: "FM",
      pack_id: "p1",
      access_raw: "",
      ctcss_tx: null,
    });
    const r = runPipeline({
      sk6baRows: [],
      packChannels: [pack],
      settings: baseSettings,
    });
    const codes = r.channels.flatMap((c) => c.warnings.map((w) => w.code));
    expect(codes).not.toContain("missing_access_tone");
    expect(codes).not.toContain("ctcss_and_dcs");
  });
});
