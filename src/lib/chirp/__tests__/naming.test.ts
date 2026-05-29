import { describe, it, expect } from "vitest";
import { buildName, resolveCollisions, translit, sanitize } from "../naming";
import { DEFAULT_SETTINGS } from "../defaults";
import { makeChannel } from "./helpers";

const naming = DEFAULT_SETTINGS.naming;

describe("translit/sanitize", () => {
  it("transliterates Swedish characters", () => {
    expect(translit("Åke Örnsköldsvik")).toBe("Ake Ornskoldsvik");
  });
  it("sanitize strips spaces and uppercases", () => {
    expect(sanitize("Hej världen!", { transliterate: true, uppercase: true })).toBe("HEJVARLDEN");
  });
});

describe("buildName", () => {
  it("uses primary city when split by /", () => {
    const ch = makeChannel({ city: "Borås/Sjuhärad" });
    const r = buildName(ch, { ...naming, components: ["{city}"], cityMaxLength: 6 }, 6);
    expect(r.full).toBe("BORAS");
    expect(r.clipped).toBe("BORAS");
  });

  it("smart-joins skipping empty tokens (no double separator)", () => {
    const ch = makeChannel({ city: "", call: "SK6BA", channel: "RV48" });
    const r = buildName(ch, { ...naming, components: ["{city}", "{call}", "{channel}"], separator: "-" }, 20);
    expect(r.full).toBe("SK6BA-RV48");
  });

  it("falls back for empty channel_pack name", () => {
    const ch = makeChannel({
      source_type: "channel_pack",
      city: "", call: "", channel: "",
      label: "CW ACT", name_hint: "CW ACT",
    });
    const r = buildName(ch, { ...naming, components: ["{city}", "{call}"] }, 12);
    expect(r.full.length).toBeGreaterThan(0);
    expect(r.full).toBe("CWACT");
  });

  it("respects maxLength clipping", () => {
    const ch = makeChannel({ city: "Stockholm" });
    const r = buildName(ch, { ...naming, components: ["{city}"], cityMaxLength: 0 }, 4);
    expect(r.clipped.length).toBe(4);
  });

  it("expands district prefix and band abbrev", () => {
    const ch = makeChannel({ district: "6", band: "2" });
    const r = buildName(ch, { ...naming, components: ["{district}", "{band}"], separator: "-" }, 20);
    expect(r.full).toBe("D6-2M");
  });
});

describe("resolveCollisions", () => {
  it("appends numeric suffixes on collision", () => {
    const a = makeChannel({ generated_name_final: "BORAS" });
    const b = makeChannel({ generated_name_final: "BORAS" });
    const c = makeChannel({ generated_name_final: "BORAS" });
    const { unresolved } = resolveCollisions([a, b, c], { ...naming, collisionPolicy: "numeric_suffix" }, 6);
    expect(unresolved).toBe(0);
    expect(a.generated_name_final).toBe("BORAS");
    expect(b.generated_name_final).not.toBe(a.generated_name_final);
    expect(c.generated_name_final).not.toBe(a.generated_name_final);
    expect(c.generated_name_final).not.toBe(b.generated_name_final);
    expect(b.collided).toBe(true);
  });

  it("policy=stop leaves collisions unresolved", () => {
    const a = makeChannel({ generated_name_final: "X" });
    const b = makeChannel({ generated_name_final: "X" });
    const { unresolved } = resolveCollisions([a, b], { ...naming, collisionPolicy: "stop" }, 6);
    expect(unresolved).toBe(1);
  });
});
