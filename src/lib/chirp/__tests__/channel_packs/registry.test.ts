import { describe, it, expect } from "vitest";
import { loadRegisteredPacks, loadMergedPacks } from "../../channel_packs/registry";

describe("registry", () => {
  it("loads both bundled packs", () => {
    const packs = loadRegisteredPacks();
    expect(packs).toHaveLength(2);
    expect(packs.map((p) => p.fileName)).toEqual(
      expect.arrayContaining([
        "se_amateur_2m_channel_pack.csv",
        "se_amateur_70cm_channel_pack.csv",
      ]),
    );
  });

  it("merges packs by pack_id", () => {
    const merged = loadMergedPacks();
    expect(merged).toHaveLength(1);
    expect(merged[0].packId).toBe("se_amateur_2m_70cm");
    const bands = new Set(merged[0].channels.map((c) => c.band));
    expect(bands.has("2m")).toBe(true);
    expect(bands.has("70cm")).toBe(true);
  });
});
