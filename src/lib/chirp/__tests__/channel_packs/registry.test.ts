import { describe, it, expect } from "vitest";
import { loadRegisteredPacks, loadMergedPacks } from "../../channel_packs/registry";

describe("registry", () => {
  it("auto-discovers all CSVs in /channelpacks", () => {
    const packs = loadRegisteredPacks();
    // Whatever ships in /channelpacks gets picked up; expect at least the 2m + 70cm pair.
    expect(packs.length).toBeGreaterThanOrEqual(2);
    const names = packs.map((p) => p.fileName);
    expect(names).toEqual(expect.arrayContaining([
      "se_amateur_2m_channel_pack.csv",
      "se_amateur_70cm_channel_pack.csv",
    ]));
  });

  it("merges 2m + 70cm into one logical amateur pack", () => {
    const merged = loadMergedPacks();
    const amateur = merged.find((p) => p.packId === "se_amateur_2m_70cm");
    expect(amateur).toBeDefined();
    const bands = new Set(amateur!.channels.map((c) => c.band));
    expect(bands.has("2m")).toBe(true);
    expect(bands.has("70cm")).toBe(true);
  });
});
