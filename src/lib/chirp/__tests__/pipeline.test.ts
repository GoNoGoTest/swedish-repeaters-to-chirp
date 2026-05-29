import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSk6baCsv } from "../importers/sk6ba";
import { parseChannelPackCsv } from "../importers/channel_pack";
import { runPipeline } from "../pipeline";
import { DEFAULT_SETTINGS } from "../defaults";
import type { Settings } from "../models";

const sk6baCsv = readFileSync(resolve(__dirname, "fixtures/sk6ba-sample.csv"), "utf8");
const pack2m = readFileSync(resolve(__dirname, "../../../../channelpacks/se_amateur_2m_channel_pack.csv"), "utf8");

const baseSettings: Settings = {
  ...DEFAULT_SETTINGS,
  filter: { ...DEFAULT_SETTINGS.filter, statuses: ["QRV"], includeUnknownDistricts: true },
};

describe("runPipeline (sk6ba only)", () => {
  it("filters out digital and QRT rows, keeps FM/QRV", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const r = runPipeline({ sk6baRows: rows, settings: baseSettings });
    // 6 rows total → expect QRV FM only (rows 1,2,4,5). Row 5 has 'foo' shift but still FM/QRV
    expect(r.sk6baCount).toBe(4);
    expect(r.packCount).toBe(0);
  });

  it("assigns final names and resolves collisions", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const r = runPipeline({ sk6baRows: rows, settings: baseSettings });
    const names = r.channels.map((c) => c.generated_name_final);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("runPipeline with channel pack", () => {
  const packRes = parseChannelPackCsv(pack2m, "p.csv");
  const packChannels = packRes.channels.slice(0, 3);

  it("placement=prepend puts pack rows first", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const r = runPipeline({
      sk6baRows: rows,
      packChannels,
      settings: { ...baseSettings, packs: { ...baseSettings.packs, placement: "prepend" } },
    });
    expect(r.channels[0].source_type).toBe("channel_pack");
    expect(r.packCount).toBe(3);
  });

  it("placement=append puts pack rows last", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const r = runPipeline({
      sk6baRows: rows,
      packChannels,
      settings: { ...baseSettings, packs: { ...baseSettings.packs, placement: "append" } },
    });
    expect(r.channels[r.channels.length - 1].source_type).toBe("channel_pack");
  });

  it("placement=off omits pack rows", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const r = runPipeline({
      sk6baRows: rows,
      packChannels,
      settings: { ...baseSettings, packs: { ...baseSettings.packs, placement: "off" } },
    });
    expect(r.packCount).toBe(0);
  });

  it("rxOnlyPolicy=skip removes rx_only rows", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const withRxOnly = packChannels.map((c, i) => i === 0 ? { ...c, rx_only: true, warnings: [...c.warnings] } : c);
    const r = runPipeline({
      sk6baRows: rows,
      packChannels: withRxOnly,
      settings: { ...baseSettings, packs: { ...baseSettings.packs, placement: "append", rxOnlyPolicy: "skip" } },
    });
    expect(r.packCount).toBe(2);
  });

  it("rxOnlyPolicy=duplex_off marks Duplex=off", () => {
    const { rows } = parseSk6baCsv(sk6baCsv);
    const withRxOnly = packChannels.map((c, i) => i === 0 ? { ...c, rx_only: true, warnings: [...c.warnings] } : c);
    const r = runPipeline({
      sk6baRows: rows,
      packChannels: withRxOnly,
      settings: { ...baseSettings, packs: { ...baseSettings.packs, placement: "append", rxOnlyPolicy: "duplex_off" } },
    });
    const rxOnly = r.channels.find((c) => c.rx_only);
    expect(rxOnly?.duplex).toBe("off");
  });
});
