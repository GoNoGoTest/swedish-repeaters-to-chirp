import { useCallback } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import type { NormalizedChannel, Settings } from "@/lib/codeplug/models";
import { requireTarget, type ExportTarget } from "@/lib/codeplug/targets";

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

export function useCodeplugDownload(input: {
  settings: Settings;
  exportChannels: NormalizedChannel[];
}) {
  const { settings, exportChannels } = input;

  const exportFiles = useCallback(async () => {
    // Narrow the registry's ExportTarget<any> once to a Record-shaped target so
    // the export/exportMany calls below don't each need an `as never` cast.
    // Each target performs its own internal narrowing from this shape.
    const target = requireTarget(settings.export.targetId) as ExportTarget<Record<string, unknown>>;
    const targetSettings = (settings.export.perTarget[settings.export.targetId]
      ?? target.defaultSettings) as Record<string, unknown>;
    const split = settings.export.split;
    const willSplit = split.mode !== "single" && !!target.exportMany;

    if (willSplit && target.exportMany) {
      const files = target.exportMany(exportChannels, targetSettings, split);
      if (files.length === 1) {
        downloadBlob(files[0].filename, files[0].content);
      } else {
        const base = target.filenameBase ?? target.id;
        await downloadZip(`${base}.zip`, files);
      }
      return;
    }
    const result = target.export(exportChannels, targetSettings);
    downloadBlob(result.filename, result.content);
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
