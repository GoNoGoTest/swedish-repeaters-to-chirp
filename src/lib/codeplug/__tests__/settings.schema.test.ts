import { describe, it, expect } from "vitest";
import { settingsSchema } from "../settings.schema";
import { DEFAULT_SETTINGS } from "../defaults";

describe("settingsSchema", () => {
  it("godkänner DEFAULT_SETTINGS", () => {
    const r = settingsSchema.safeParse(DEFAULT_SETTINGS);
    expect(r.success).toBe(true);
  });

  it("avvisar strukturellt trasig payload (filter saknar struktur)", () => {
    const broken = { ...DEFAULT_SETTINGS, filter: 5 };
    const r = settingsSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it("avvisar ogiltigt collisionPolicy-värde", () => {
    const broken = {
      ...DEFAULT_SETTINGS,
      naming: { ...DEFAULT_SETTINGS.naming, collisionPolicy: "not_a_policy" },
    };
    const r = settingsSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it("släpper igenom okända toppnivåfält via passthrough", () => {
    const withExtra = { ...DEFAULT_SETTINGS, unknownField: 123 };
    const r = settingsSchema.safeParse(withExtra);
    expect(r.success).toBe(true);
  });
});
