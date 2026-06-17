import type { ChirpSettings } from "../models";
import type { ExportTarget } from "./types";
import type { VgcN76Settings } from "./vgc-n76";

/**
 * Closed mapping from target id → its settings type. Adding a new target
 * means adding an entry here so the compiler can narrow `AnyExportTarget`
 * via `target.id === "..."` at call sites — no casts needed.
 */
export interface TargetSettingsMap {
  "chirp-generic": ChirpSettings;
  "vgc-n76": VgcN76Settings;
}

export type TargetId = keyof TargetSettingsMap;

/** Discriminated union of every registered target, keyed on `id`. */
export type AnyExportTarget = {
  [K in TargetId]: ExportTarget<TargetSettingsMap[K]> & { id: K };
}[TargetId];

// Internally we store with a widened settings type; `registerTarget` is the
// only entry point and it's typed on the way in, so the read-side cast to
// `AnyExportTarget` is safe.
const targets = new Map<string, ExportTarget<unknown>>();

export function registerTarget<K extends TargetId>(
  target: ExportTarget<TargetSettingsMap[K]> & { id: K },
): void {
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
 * fully-typed settings object for that specific target. The single internal
 * cast is justified by `TargetSettingsMap` being the source of truth for
 * which id maps to which settings shape.
 */
export function resolveTargetSettings<T extends AnyExportTarget>(
  target: T,
  stored: Record<string, unknown> | undefined,
): T["defaultSettings"] {
  return {
    ...(target.defaultSettings as object),
    ...(stored ?? {}),
  } as T["defaultSettings"];
}
