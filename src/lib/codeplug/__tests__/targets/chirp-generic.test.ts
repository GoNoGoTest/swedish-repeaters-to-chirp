import { describe, it, expect } from "vitest";
import { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "@/lib/codeplug/targets/chirp-generic";
import { exportChirpCsv } from "@/lib/codeplug/exporters/chirp";
import { makeChannel } from "../helpers";

describe("targets/chirp-generic", () => {
  it("metadata: id, label, vendor, extension", () => {
    expect(CHIRP_GENERIC_TARGET.id).toBe("chirp-generic");
    expect(CHIRP_GENERIC_TARGET.vendor).toBe("CHIRP");
    expect(CHIRP_GENERIC_TARGET.fileExtension).toBe("csv");
  });

  it("supportedSignalModes innehåller inte Tetra (Generic CSV bär inte Tetra)", () => {
    expect(CHIRP_GENERIC_TARGET.limits.supportedSignalModes).not.toContain("Tetra");
  });

  it("resolveMaxNameLength returns user-tunable chirp maxLength", () => {
    const len = CHIRP_GENERIC_TARGET.resolveMaxNameLength!({
      ...CHIRP_GENERIC_DEFAULTS,
      maxLength: 9,
    });
    expect(len).toBe(9);
  });

  it("produces byte-identical output to the underlying exporter (regression)", () => {
    const c1 = makeChannel({
      source_type: "sk6ba",
      generated_name_final: "ABC",
      rx_frequency: 145.6125,
      duplex: "-",
      offset: 0.6,
    });
    const c2 = makeChannel({
      source_type: "channel_pack",
      generated_name_final: "S20",
      rx_frequency: 145.3,
      duplex: "",
    });
    const channels = [c1, c2];
    const direct = exportChirpCsv(channels, CHIRP_GENERIC_DEFAULTS);
    const viaTarget = CHIRP_GENERIC_TARGET.export(channels, CHIRP_GENERIC_DEFAULTS);
    expect(viaTarget.content).toBe(direct);
    expect(viaTarget.filename).toBe("chirp.csv");
    expect(viaTarget.warnings).toEqual([]);
  });

  it("emits a non-blocking digital warning when any channel has a digital effective mode", () => {
    const c = makeChannel({ generated_name_final: "X", mode_effective: "C4FM" });
    const result = CHIRP_GENERIC_TARGET.export([c], CHIRP_GENERIC_DEFAULTS);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("chirp_digital_partial");
    expect(result.warnings[0].message).toMatch(/CHIRP Generic CSV/);
    expect(result.warnings[0].message).toMatch(/digitala/i);
  });

  it("emits no warnings when only analog FM channels are exported", () => {
    const c = makeChannel({ generated_name_final: "X", mode_effective: "FM" });
    const result = CHIRP_GENERIC_TARGET.export([c], CHIRP_GENERIC_DEFAULTS);
    expect(result.warnings).toEqual([]);
  });

  it("validate() also surfaces digital warnings (for multi-file split path)", () => {
    const c = makeChannel({ generated_name_final: "X", mode_effective: "DMR" });
    const warns = CHIRP_GENERIC_TARGET.validate!([c], CHIRP_GENERIC_DEFAULTS);
    expect(warns).toHaveLength(1);
    expect(warns[0].code).toBe("chirp_digital_partial");
  });
});
