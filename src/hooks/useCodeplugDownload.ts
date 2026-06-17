import { useCallback } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import type { NormalizedChannel, Settings } from "@/lib/codeplug/models";
import { requireTarget, resolveTargetSettings, type AnyExportTarget } from "@/lib/codeplug/targets";

function downloadBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(filename: string, files: { filename: string; content: string }[]) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.filename, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/**
 * Resolve settings for a target and invoke its export/exportMany. The
 * generic `<T extends AnyExportTarget>` keeps `target` and `settings`
 * paired via TargetSettingsMap, so no per-call cast is needed.
 */
function runExport<T extends AnyExportTarget>(
  target: T,
  stored: Record<string, unknown> | undefined,
  channels: NormalizedChannel[],
  split: Settings["export"]["split"],
) {
  const settings = resolveTargetSettings(target, stored);
  const willSplit = split.mode !== "single" && !!target.exportMany;
  if (willSplit && target.exportMany) {
    return { kind: "many" as const, files: target.exportMany(channels, settings, split) };
  }
  return { kind: "one" as const, result: target.export(channels, settings) };
}

export function useCodeplugDownload(input: {
  settings: Settings;
  exportChannels: NormalizedChannel[];
}) {
  const { settings, exportChannels } = input;

  const exportFiles = useCallback(async () => {
    const target = requireTarget(settings.export.targetId);
    const stored = settings.export.perTarget[settings.export.targetId];
    const out = runExport(target, stored, exportChannels, settings.export.split);
    if (out.kind === "many") {
      if (out.files.length === 1) {
        downloadBlob(out.files[0].filename, out.files[0].content);
      } else {
        const base = target.filenameBase ?? target.id;
        await downloadZip(`${base}.zip`, out.files);
      }
      return;
    }
    downloadBlob(out.result.filename, out.result.content);
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
