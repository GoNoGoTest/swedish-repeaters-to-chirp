import type { ParseWarning } from "@/lib/codeplug/importers/schemas";

const MAX_ROWS = 50;

/**
 * Expanderbar varningspanel för parse-fel per rad/kolumn. Bygger på
 * `<details>` så `open`-state är inbyggt i DOM (ingen lokal state) och
 * raderna alltid finns i markup — testbar utan toggle-händelse.
 */
export function ParseWarningsPanel({
  title,
  warnings,
  initialVisible = 3,
}: {
  title: string;
  warnings: ParseWarning[];
  initialVisible?: number;
}) {
  if (warnings.length === 0) return null;

  const shown = warnings.slice(0, MAX_ROWS);
  const overflow = warnings.length - shown.length;
  const preview = shown.slice(0, initialVisible);
  const rest = shown.slice(initialVisible);

  const firstRows = warnings
    .slice(0, 3)
    .map((w) => w.row)
    .filter((r): r is number => r != null);
  const rowsHint =
    firstRows.length > 0
      ? ` (rad ${firstRows.join(", ")}${warnings.length > 3 ? ", …" : ""})`
      : "";

  return (
    <details className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300">
      <summary className="cursor-pointer select-none px-3 py-2 font-medium">
        ⚠ {warnings.length} parse-varning
        {warnings.length === 1 ? "" : "ar"} {title.toLowerCase()}
        {rowsHint}
      </summary>
      <div className="overflow-x-auto px-3 pb-3">
        <WarningsTable preview={preview} rest={rest} />
        {overflow > 0 && (
          <div className="mt-2 italic text-amber-700/80 dark:text-amber-300/80">
            … och {overflow} till (visas inte — filtrera CSV:n för fler detaljer)
          </div>
        )}
      </div>
    </details>
  );
}

function WarningsTable({ preview, rest }: { preview: ParseWarning[]; rest: ParseWarning[] }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-amber-500/30 text-amber-700/80 dark:text-amber-300/80">
          <th className="py-1 pr-3 font-medium">Rad</th>
          <th className="py-1 pr-3 font-medium">Kolumn</th>
          <th className="py-1 pr-3 font-medium">Kod</th>
          <th className="py-1 font-medium">Meddelande</th>
        </tr>
      </thead>
      <tbody>
        {preview.map((w, i) => (
          <Row key={`p-${i}`} w={w} />
        ))}
        {rest.map((w, i) => (
          <Row key={`r-${i}`} w={w} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ w }: { w: ParseWarning }) {
  return (
    <tr className="border-b border-amber-500/10 last:border-0 align-top">
      <td className="py-1 pr-3 font-mono">{w.row ?? "—"}</td>
      <td className="py-1 pr-3 font-mono">{w.column ?? "—"}</td>
      <td className="py-1 pr-3 font-mono text-[11px]">{w.code}</td>
      <td className="py-1">{w.message}</td>
    </tr>
  );
}
