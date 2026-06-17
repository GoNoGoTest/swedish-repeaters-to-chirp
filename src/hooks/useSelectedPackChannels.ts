import { useMemo } from "react";
import type { NormalizedChannel, Settings } from "@/lib/codeplug/models";
import { loadMergedPacks, type MergedPack } from "@/lib/codeplug/channel_packs/registry";
import { selectPackChannels, type ParsedPackChannel } from "@/lib/codeplug/importers/channel_pack";

export function useSelectedPackChannels(settings: Settings): {
  packs: MergedPack[];
  selectedChannels: NormalizedChannel[];
  enabledPackCount: number;
} {
  const packs = useMemo(() => loadMergedPacks(), []);

  const selectedChannels = useMemo<NormalizedChannel[]>(() => {
    if (settings.packs.placement === "off") return [];
    const out: ParsedPackChannel[] = [];
    for (const pack of packs) {
      const sel = settings.packs.selection[pack.packId];
      if (!sel?.enabled) continue;
      const picked = selectPackChannels(pack.channels, {
        bands: sel.bands,
        categories: sel.categories,
        tags: sel.tags,
        useEnabledDefault: sel.useEnabledDefault,
        manualSourceIds: sel.manualSourceIds && sel.manualSourceIds.length > 0 ? sel.manualSourceIds : undefined,
      });
      out.push(...picked);
    }
    return out;
  }, [packs, settings.packs.placement, settings.packs.selection]);

  const enabledPackCount = useMemo(
    () => Object.values(settings.packs.selection).filter((s) => s.enabled).length,
    [settings.packs.selection],
  );

  return { packs, selectedChannels, enabledPackCount };
}
