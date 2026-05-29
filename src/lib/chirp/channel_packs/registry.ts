import pack2m from "../../../../channelpacks/se_amateur_2m_channel_pack.csv?raw";
import pack70cm from "../../../../channelpacks/se_amateur_70cm_channel_pack.csv?raw";
import { parseChannelPackCsv, type PackParseResult } from "../importers/channel_pack";

export interface RegisteredPack {
  fileName: string;
  result: PackParseResult;
}

const RAW_PACKS: Array<{ fileName: string; text: string }> = [
  { fileName: "se_amateur_2m_channel_pack.csv", text: pack2m },
  { fileName: "se_amateur_70cm_channel_pack.csv", text: pack70cm },
];

let cache: RegisteredPack[] | null = null;

export function loadRegisteredPacks(): RegisteredPack[] {
  if (cache) return cache;
  cache = RAW_PACKS.map(({ fileName, text }) => ({
    fileName,
    result: parseChannelPackCsv(text, fileName),
  }));
  return cache;
}

/**
 * Merge packs that share the same logical pack_id so the UI shows one entry
 * with combined rows (the medföljande 2m and 70cm-filer båda säger
 * `se_amateur_2m_70cm`).
 */
export function loadMergedPacks() {
  const all = loadRegisteredPacks();
  const map = new Map<string, { packId: string; channels: PackParseResult["channels"]; fileNames: string[]; headerWarnings: string[] }>();
  for (const r of all) {
    const id = r.result.packId;
    const existing = map.get(id);
    if (existing) {
      existing.channels.push(...r.result.channels);
      existing.fileNames.push(r.fileName);
      existing.headerWarnings.push(...r.result.headerWarnings);
    } else {
      map.set(id, {
        packId: id,
        channels: [...r.result.channels],
        fileNames: [r.fileName],
        headerWarnings: [...r.result.headerWarnings],
      });
    }
  }
  return Array.from(map.values());
}
