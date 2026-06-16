import type { ExportTarget } from "./types";

const targets = new Map<string, ExportTarget<any>>();

export function registerTarget<T>(target: ExportTarget<T>): void {
  // Idempotent: re-register on HMR / double module evaluation (SSR + client) is fine.
  const existing = targets.get(target.id);
  if (existing && existing !== target) {
    // Replace silently; throwing breaks SSR when the module graph evaluates twice.
  }
  targets.set(target.id, target as ExportTarget<any>);
}

export function getTarget(id: string): ExportTarget<any> | undefined {
  return targets.get(id);
}

export function requireTarget(id: string): ExportTarget<any> {
  const t = targets.get(id);
  if (!t) throw new Error(`Unknown export target: ${id}`);
  return t;
}

export function listTargets(): ExportTarget<any>[] {
  return Array.from(targets.values());
}

/** Test helper — clears the registry. Not for app code. */
export function __resetTargetsForTests(): void {
  targets.clear();
}
