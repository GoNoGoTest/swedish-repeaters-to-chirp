// Side-effect imports register each target with the registry at app start.
import "./chirp-generic";
import "./vgc-n76";
import "./nicsure-rt880";
import "./rt-systems-yaesu";

export {
  listTargets, getTarget, requireTarget, registerTarget, resolveTargetSettings,
  type AnyExportTarget, type TargetId, type TargetSettingsMap,
} from "./registry";
export type { ExportTarget, ExportResult, ExportFile, HardwareLimits } from "./types";
export { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "./chirp-generic";
export { VGC_N76_TARGET, VGC_N76_DEFAULTS, type VgcN76Settings } from "./vgc-n76";
export {
  NICSURE_RT880_TARGET, NICSURE_RT880_DEFAULTS,
  type NicsureRt880Settings,
} from "./nicsure-rt880";
export {
  RT_SYSTEMS_YAESU_TARGET, RT_SYSTEMS_YAESU_DEFAULTS,
  type RtSystemsYaesuSettings,
} from "./rt-systems-yaesu";


