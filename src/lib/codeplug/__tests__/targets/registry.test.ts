import { describe, it, expect } from "vitest";
import "../../targets"; // registers all targets
import { CHIRP_GENERIC_DEFAULTS } from "../../targets/chirp-generic";
import { requireTarget, resolveTargetSettings } from "../../targets/registry";

const chirp = () => requireTarget("chirp-generic");

describe("resolveTargetSettings", () => {
  it("merger defaults med giltig patch", () => {
    const out = resolveTargetSettings(chirp(), { maxLength: 8 });
    // Vi vet att det är chirp-generic här; cast för läsbarhet.
    expect((out as { maxLength: number }).maxLength).toBe(8);
    expect((out as { mode: string }).mode).toBe(CHIRP_GENERIC_DEFAULTS.mode);
  });

  it("faller tillbaka på defaults när schemat avvisar patchen", () => {
    const out = resolveTargetSettings(chirp(), { maxLength: -5 });
    expect(out).toEqual(CHIRP_GENERIC_DEFAULTS);
  });

  it("faller tillbaka på defaults för fel typ", () => {
    const out = resolveTargetSettings(chirp(), { maxLength: "broken" });
    expect(out).toEqual(CHIRP_GENERIC_DEFAULTS);
  });

  it("ingen patch ⇒ defaults", () => {
    const out = resolveTargetSettings(chirp(), undefined);
    expect(out).toEqual(CHIRP_GENERIC_DEFAULTS);
  });
});
