// Side-effect imports register each target with the registry at app start.
import "./chirp-generic";
import "./vgc-n76";

export { listTargets, getTarget, requireTarget, registerTarget } from "./registry";
export type { ExportTarget, ExportResult, ExportFile, HardwareLimits } from "./types";
export { CHIRP_GENERIC_TARGET, CHIRP_GENERIC_DEFAULTS } from "./chirp-generic";
export { VGC_N76_TARGET, VGC_N76_DEFAULTS, type VgcN76Settings } from "./vgc-n76";

