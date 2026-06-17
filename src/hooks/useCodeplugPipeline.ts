import { useMemo } from "react";
import type { NormalizedChannel, RawRow, Settings } from "@/lib/codeplug/models";
import { runPipeline } from "@/lib/codeplug/pipeline";

export function useCodeplugPipeline(input: {
  rows: RawRow[] | null;
  packChannels: NormalizedChannel[];
  settings: Settings;
  maxNameLength: number;
}) {
  const { rows, packChannels, settings, maxNameLength } = input;
  return useMemo(() => {
    if (!rows) return null;
    return runPipeline({
      sk6baRows: rows,
      packChannels,
      settings,
      maxNameLength,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    packChannels,
    settings.filter,
    settings.naming,
    settings.packs,
    settings.sort,
    settings.export,
    maxNameLength,
  ]);
}
