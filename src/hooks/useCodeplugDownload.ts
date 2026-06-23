import { useCallback } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import type { NormalizedChannel, Settings, SplitSettings, Warning } from "@/lib/codeplug/models";
import {
  requireTarget,
  resolveTargetSettings,
  type AnyExportTarget,
  type ExportManyResult,
  type ExportResult,
} from "@/lib/codeplug/targets";

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(filename: string, files: { filename: string; content: string }[]) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.filename, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Switch on the discriminated `id` so TypeScript narrows `target` to a
 * concrete `ExportTarget<TSettings>`; from there `resolveTargetSettings`
 * yields the right settings shape and `target.export`/`exportMany` are
 * called with no `as never` / cast at the call site.
 */
function invokeTarget(
  target: AnyExportTarget,
  stored: unknown,
  channels: NormalizedChannel[],
  split: SplitSettings,
): { one: ExportResult } | { many: ExportManyResult } {
  const willSplit = split.mode !== "single" && !!target.exportMany;
  const storedPatch = stored as Record<string, unknown> | undefined;
  switch (target.id) {
    case "chirp-generic": {
      const s = resolveTargetSettings(target, storedPatch);
      if (willSplit && target.exportMany) return { many: target.exportMany(channels, s, split) };
      return { one: target.export(channels, s) };
    }
    case "vgc-n76": {
      const s = resolveTargetSettings(target, storedPatch);
      if (willSplit && target.exportMany) return { many: target.exportMany(channels, s, split) };
      return { one: target.export(channels, s) };
    }
    case "nicsure-rt880": {
      const s = resolveTargetSettings(target, storedPatch);
      if (willSplit && target.exportMany) return { many: target.exportMany(channels, s, split) };
      return { one: target.export(channels, s) };
    }
    case "rt-systems-yaesu-generic": {
      const s = resolveTargetSettings(target, storedPatch);
      if (willSplit && target.exportMany) return { many: target.exportMany(channels, s, split) };
      return { one: target.export(channels, s) };
    }
  }
}

export function useCodeplugDownload(input: {
  settings: Settings;
  exportChannels: NormalizedChannel[];
}) {
  const { settings, exportChannels } = input;

  const exportFiles = useCallback(async (): Promise<Warning[]> => {
    const target = requireTarget(settings.export.targetId);
    const out = invokeTarget(
      target,
      settings.export.perTarget[settings.export.targetId],
      exportChannels,
      settings.export.split,
    );
    if ("many" in out) {
      const { files, warnings } = out.many;
      if (files.length === 1) {
        downloadBlob(files[0].filename, files[0].content);
      } else {
        const base = target.filenameBase ?? target.id;
        await downloadZip(`${base}.zip`, files);
      }
      return warnings;
    }
    downloadBlob(out.one.filename, out.one.content);
    return out.one.warnings;
  }, [settings, exportChannels]);

  const exportWarnings = useCallback(() => {
    const reportRows = exportChannels
      .filter((c) => c.warnings.length)
      .map((c) => ({
        source_type: c.source_type,
        source_row: c.source_row,
        source_id: c.source_id,
        pack_id: c.pack_id,
        name: c.generated_name_final,
        warnings: c.warnings.map((w) => w.message).join("; "),
      }));
    const csv = Papa.unparse(reportRows, {
      columns: ["source_type", "source_row", "source_id", "pack_id", "name", "warnings"],
    });
    downloadBlob("varningar.csv", csv);
  }, [exportChannels]);

  return { exportFiles, exportWarnings };
}
