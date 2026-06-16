import { describe, it, expect, beforeEach } from "vitest";
import { registerTarget, getTarget, requireTarget, listTargets, __resetTargetsForTests } from "@/lib/chirp/targets/registry";
import type { ExportTarget } from "@/lib/chirp/targets/types";

const dummy: ExportTarget<{ x: number }> = {
  id: "dummy-target",
  label: "Dummy",
  vendor: "Test",
  fileExtension: "csv",
  limits: { maxNameLength: 8, supportedModes: ["FM"], supportsSplit: false, supportsCtcss: true, supportsDcs: false },
  defaultSettings: { x: 1 },
  export: () => ({ filename: "dummy.csv", content: "", warnings: [] }),
};

describe("targets/registry", () => {
  beforeEach(() => __resetTargetsForTests());

  it("registers and retrieves targets by id", () => {
    registerTarget(dummy);
    expect(getTarget("dummy-target")).toBe(dummy);
    expect(requireTarget("dummy-target")).toBe(dummy);
    expect(listTargets()).toHaveLength(1);
  });

  it("throws on duplicate id", () => {
    registerTarget(dummy);
    expect(() => registerTarget(dummy)).toThrow(/already registered/);
  });

  it("requireTarget throws on unknown id", () => {
    expect(() => requireTarget("nope")).toThrow(/Unknown export target/);
  });

  it("getTarget returns undefined for unknown id", () => {
    expect(getTarget("nope")).toBeUndefined();
  });
});
