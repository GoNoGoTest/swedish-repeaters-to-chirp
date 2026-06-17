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
 * Distribute over AnyExportTarget so `target.export(channels, settings)`
 * is callable: without distribution TS narrows method params to the
 * intersection of every variant's settings type, which never matches.
 */
type ExportInvocation<T extends AnyExportTarget> = T extends AnyExportTarget
  ? { target: T; settings: T["defaultSettings"] }
  : never;

function buildInvocation(
  target: AnyExportTarget,
  stored: unknown,
): ExportInvocation<AnyExportTarget> {
  const settings = resolveTargetSettings(
    target,
    (stored as Record<string, unknown> | undefined) ?? undefined,
  );
  return { target, settings } as ExportInvocation<AnyExportTarget>;
}

export function useCodeplugDownload(input: {
  settings: Settings;
  exportChannels: NormalizedChannel[];
}) {
  const { settings, exportChannels } = input;

  const exportFiles = useCallback(async () => {
    const target = requireTarget(settings.export.targetId);
    const inv = buildInvocation(target, settings.export.perTarget[settings.export.targetId]);
    const split = settings.export.split;
    const willSplit = split.mode !== "single" && !!inv.target.exportMany;

    if (willSplit && inv.target.exportMany) {
      const files = inv.target.exportMany(exportChannels, inv.settings, split);
      if (files.length === 1) {
        downloadBlob(files[0].filename, files[0].content);
      } else {
        const base = inv.target.filenameBase ?? inv.target.id;
        await downloadZip(`${base}.zip`, files);
      }
      return;
    }
    const result = inv.target.export(exportChannels, inv.settings);
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
