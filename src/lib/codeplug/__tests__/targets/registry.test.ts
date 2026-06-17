import { describe, it, expect, beforeEach } from "vitest";
import { registerTarget, getTarget, requireTarget, listTargets, __resetTargetsForTests } from "@/lib/codeplug/targets/registry";
import type { ExportTarget } from "@/lib/codeplug/targets/types";

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

  it("is idempotent when the same target is registered twice", () => {
    // Module graphs evaluate twice under SSR + client hydration / HMR, so
    // re-registering the exact same target object must be a silent no-op.
    registerTarget(dummy);
    expect(() => registerTarget(dummy)).not.toThrow();
    expect(listTargets()).toHaveLength(1);
    expect(getTarget("dummy-target")).toBe(dummy);
  });

  it("replaces a target when a different object is registered under the same id", () => {
    registerTarget(dummy);
    const replacement: ExportTarget<{ x: number }> = { ...dummy, label: "Dummy v2" };
    registerTarget(replacement);
    expect(getTarget("dummy-target")).toBe(replacement);
    expect(listTargets()).toHaveLength(1);
  });

  it("requireTarget throws on unknown id", () => {
    expect(() => requireTarget("nope")).toThrow(/Unknown export target/);
  });

  it("getTarget returns undefined for unknown id", () => {
    expect(getTarget("nope")).toBeUndefined();
  });
});
