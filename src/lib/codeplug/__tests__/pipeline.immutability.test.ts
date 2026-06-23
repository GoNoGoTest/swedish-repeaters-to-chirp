import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSk6baCsv } from "../importers/sk6ba";
import { parseChannelPackCsv } from "../importers/channel_pack";
import { runPipeline } from "../pipeline";
import { DEFAULT_SETTINGS } from "../defaults";
import type { Settings } from "../models";

const sk6baCsv = readFileSync(resolve(__dirname, "fixtures/sk6ba-sample.csv"), "utf8");
const pack2m = readFileSync(
  resolve(__dirname, "../../../../channelpacks/se_amateur_2m_channel_pack.csv"),
  "utf8",
);

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  filter: {
    ...DEFAULT_SETTINGS.filter,
    statuses: ["QRV"],
    includeUnknownRegions: true,
    countries: [],
  },
  packs: {
    ...DEFAULT_SETTINGS.packs,
    placement: "prepend",
    rxOnlyPolicy: "mark",
  },
};

describe("runPipeline immutability", () => {
  it("does not mutate the packChannels input across repeated runs", () => {
    const { rows: sk6baRows } = parseSk6baCsv(sk6baCsv);
    const packRes = parseChannelPackCsv(pack2m, "se-2m");
    const packChannels = packRes.channels.slice(0, 5);

    // Snapshot before any pipeline run.
    const snapshot = JSON.parse(JSON.stringify(packChannels));

    const r1 = runPipeline({ sk6baRows, packChannels, settings });
    // Input is unchanged after first run.
    expect(JSON.parse(JSON.stringify(packChannels))).toEqual(snapshot);

    const r2 = runPipeline({ sk6baRows, packChannels, settings });
    // Input is still unchanged after second run.
    expect(JSON.parse(JSON.stringify(packChannels))).toEqual(snapshot);

    // And the result is identical between runs (no accumulated warnings,
    // generated names, etc.).
    expect(r1.channels.length).toBe(r2.channels.length);
    for (let i = 0; i < r1.channels.length; i++) {
      const a = r1.channels[i];
      const b = r2.channels[i];
      expect(a.warnings.length).toBe(b.warnings.length);
      expect(a.generated_name_final).toBe(b.generated_name_final);
      expect(a.generated_name_full).toBe(b.generated_name_full);
      expect(a.collided).toBe(b.collided);
      expect(a.comment).toBe(b.comment);
      expect(a.duplex).toBe(b.duplex);
    }
  });

  it("applies RX-only block_tx policy without mutating the input pack rows", () => {
    const { rows: sk6baRows } = parseSk6baCsv(sk6baCsv);
    const packRes = parseChannelPackCsv(pack2m, "se-2m");
    const packChannels = packRes.channels.slice(0, 3).map((c) => ({ ...c, rx_only: true }));
    const snapshot = JSON.parse(JSON.stringify(packChannels));

    const blockSettings: Settings = {
      ...settings,
      packs: { ...settings.packs, rxOnlyPolicy: "block_tx" },
    };
    const r = runPipeline({ sk6baRows, packChannels, settings: blockSettings });

    // Input rows are still rx_only with their original duplex/warnings.
    expect(JSON.parse(JSON.stringify(packChannels))).toEqual(snapshot);
    // Output rows reflect the policy.
    const blocked = r.channels.filter((c) => c.source_type === "channel_pack");
    for (const ch of blocked) {
      expect(ch.duplex).toBe("off");
      expect(ch.warnings.some((w) => w.code === "rx_only_blocked")).toBe(true);
    }
  });
});
