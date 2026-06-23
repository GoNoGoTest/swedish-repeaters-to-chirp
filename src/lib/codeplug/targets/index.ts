// Explicit value imports + registration. Using named value imports (instead of
// bare side-effect imports) ensures the target modules are retained by the
// bundler even with `"sideEffects": false` in package.json — otherwise targets
// that aren't referenced elsewhere (e.g. rt-systems-yaesu) get tree-shaken
// out of the production build and disappear from the export-format picker.
import { registerTarget } from "./registry";
import { CHIRP_GENERIC_TARGET } from "./chirp-generic";
import { VGC_N76_TARGET } from "./vgc-n76";
import { NICSURE_RT880_TARGET } from "./nicsure-rt880";
import { RT_SYSTEMS_YAESU_TARGET } from "./rt-systems-yaesu";

// Idempotent — modules also self-register at their bottom for backwards compat.
registerTarget(CHIRP_GENERIC_TARGET);
registerTarget(VGC_N76_TARGET);
registerTarget(NICSURE_RT880_TARGET);
registerTarget(RT_SYSTEMS_YAESU_TARGET);

export {
  listTargets,
  getTarget,
  requireTarget,
  registerTarget,
  resolveTargetSettings,
  type AnyExportTarget,
  type TargetId,
  type TargetSettingsMap,
} from "./registry";
export type {
  ExportTarget,
  ExportResult,
  ExportFile,
  ExportManyResult,
  HardwareLimits,
} from "./types";
export { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "./chirp-generic";
export { VGC_N76_TARGET, VGC_N76_DEFAULTS, type VgcN76Settings } from "./vgc-n76";
export {
  NICSURE_RT880_TARGET,
  NICSURE_RT880_DEFAULTS,
  type NicsureRt880Settings,
} from "./nicsure-rt880";
export {
  RT_SYSTEMS_YAESU_TARGET,
  RT_SYSTEMS_YAESU_DEFAULTS,
  type RtSystemsYaesuSettings,
} from "./rt-systems-yaesu";
