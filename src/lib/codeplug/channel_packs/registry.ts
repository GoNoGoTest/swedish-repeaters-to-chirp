import { parseChannelPackCsv, type PackParseResult } from "../importers/channel_pack";
import type { ParseWarning } from "../importers/schemas";

// Auto-discover all CSV files in /channelpacks at build time.
// New files added to that directory are picked up without code changes.
const RAW_MODULES = import.meta.glob("../../../../channelpacks/*.csv", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const RAW_PACKS: Array<{ fileName: string; text: string }> = Object.entries(RAW_MODULES)
  .map(([path, text]) => ({ fileName: path.split("/").pop() ?? path, text }))
  .sort((a, b) => a.fileName.localeCompare(b.fileName));

export interface RegisteredPack {
  fileName: string;
  result: PackParseResult;
}

let cache: RegisteredPack[] | null = null;

export function loadRegisteredPacks(): RegisteredPack[] {
  if (cache) return cache;
  cache = RAW_PACKS.map(({ fileName, text }) => ({
    fileName,
    result: parseChannelPackCsv(text, fileName),
  }));
  return cache;
}

export interface MergedPack {
  packId: string;
  channels: PackParseResult["channels"];
  fileNames: string[];
  headerWarnings: string[];
  parseWarnings: ParseWarning[];
}

/**
 * Merge packs that share the same logical pack_id so the UI shows one entry
 * with combined rows (e.g. 2m + 70cm split across two CSVs).
 */
export function loadMergedPacks(): MergedPack[] {
  const all = loadRegisteredPacks();
  const map = new Map<string, MergedPack>();
  for (const r of all) {
    const id = r.result.packId;
    const existing = map.get(id);
    if (existing) {
      existing.channels.push(...r.result.channels);
      existing.fileNames.push(r.fileName);
      existing.headerWarnings.push(...r.result.headerWarnings);
      existing.parseWarnings.push(...r.result.parseWarnings);
    } else {
      map.set(id, {
        packId: id,
        channels: [...r.result.channels],
        fileNames: [r.fileName],
        headerWarnings: [...r.result.headerWarnings],
        parseWarnings: [...r.result.parseWarnings],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.packId.localeCompare(b.packId));
}
