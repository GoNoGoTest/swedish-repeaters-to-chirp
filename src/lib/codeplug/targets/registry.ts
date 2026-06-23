import type { ChirpSettings } from "../models";
import type { ExportTarget } from "./types";
import type { VgcN76Settings } from "./vgc-n76";
import type { NicsureRt880Settings } from "./nicsure-rt880";
import type { RtSystemsYaesuSettings } from "./rt-systems-yaesu";

/**
 * Closed mapping from target id → its settings type. Adding a new target
 * means adding an entry here so the compiler can narrow `AnyExportTarget`
 * via `target.id === "..."` at call sites — no casts needed.
 */
export interface TargetSettingsMap {
  "chirp-generic": ChirpSettings;
  "vgc-n76": VgcN76Settings;
  "nicsure-rt880": NicsureRt880Settings;
  "rt-systems-yaesu-generic": RtSystemsYaesuSettings;
}

export type TargetId = keyof TargetSettingsMap;

/** Discriminated union of every registered target, keyed on `id`. */
export type AnyExportTarget = {
  [K in TargetId]: ExportTarget<TargetSettingsMap[K]> & { id: K };
}[TargetId];

// Internally we store with a widened settings type; `registerTarget` is the
// only entry point and it's typed on the way in, so the read-side cast to
// `AnyExportTarget` is safe.
// Internally we store with a widened settings type. The read-side narrowing
// (AnyExportTarget) is safe because TargetSettingsMap is the source of truth
// for which id → settings shape, and only the two real target modules call
// registerTarget at startup (tests register dummies with their own ids).
const targets = new Map<string, ExportTarget<unknown>>();

// Loose write-side signature: keeps test helpers and future targets ergonomic.
// Read-side APIs below carry the strict mapping.
export function registerTarget<T>(target: ExportTarget<T>): void {
  // Idempotent: re-register on HMR / double module evaluation (SSR + client) is fine.
  targets.set(target.id, target as ExportTarget<unknown>);
}

export function getTarget(id: string): AnyExportTarget | undefined {
  return targets.get(id) as AnyExportTarget | undefined;
}

export function requireTarget(id: string): AnyExportTarget {
  const t = targets.get(id);
  if (!t) throw new Error(`Unknown export target: ${id}`);
  return t as AnyExportTarget;
}

export function listTargets(): AnyExportTarget[] {
  return Array.from(targets.values()) as AnyExportTarget[];
}

/** Test helper — clears the registry. Not for app code. */
export function __resetTargetsForTests(): void {
  targets.clear();
}

/**
 * Merge a target's defaults with the user's persisted patch, producing a
 * fully-typed settings object for that specific target. If the target
 * deklarerar ett `settingsSchema` valideras den sammanslagna payloaden mot
 * det — vid schemafel faller vi tillbaka på defaults för det target.
 */
export function resolveTargetSettings<T extends AnyExportTarget>(
  target: T,
  stored: Record<string, unknown> | undefined,
): T["defaultSettings"] {
  const merged = {
    ...(target.defaultSettings as object),
    ...(stored ?? {}),
  };
  if (target.settingsSchema) {
    const parsed = target.settingsSchema.safeParse(merged);
    if (parsed.success) {
      return parsed.data as T["defaultSettings"];
    }
    // Trasig patch: använd defaults istället för att läcka ut ogiltiga värden.
    return target.defaultSettings as T["defaultSettings"];
  }
  return merged as unknown as T["defaultSettings"];
}
