import {
  freshnessOf,
  relativeTime,
  formatBytes,
  type SavedExport,
} from "@/lib/codeplug/saved-exports";
import type { Sk6baLoadState } from "@/lib/codeplug/importers/sk6ba";
import { ParseWarningsPanel } from "./ParseWarningsPanel";

const FRESHNESS_DOT: Record<"fresh" | "stale" | "old", string> = {
  fresh: "bg-emerald-500",
  stale: "bg-amber-500",
  old: "bg-red-500",
};

function SavedExportsPanel({
  items,
  onPick,
  onDelete,
  onClear,
}: {
  items: SavedExport[];
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Sparade exporter</span>
        <span className="text-[11px] text-muted-foreground">max 5 senaste</span>
      </div>
      {items.length === 0 ? (
        <p className="my-4 text-xs text-muted-foreground">
          Ingen sparad än. Filer du laddar upp dyker upp här så du kan välja dem direkt nästa gång.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((e) => {
            const f = freshnessOf(e.savedAt);
            return (
              <li key={e.id} className="group flex items-center gap-3 py-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${FRESHNESS_DOT[f]}`}
                  aria-label={
                    f === "fresh" ? "färsk" : f === "stale" ? "några veckor" : "kan vara gammal"
                  }
                  title={new Date(e.savedAt).toLocaleString("sv-SE")}
                />
                <button
                  type="button"
                  onClick={() => onPick(e.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-medium">{e.filename}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {relativeTime(e.savedAt)} · {e.rowCount} rader · {formatBytes(e.byteSize)}
                    {f === "old" && <span className="ml-1 text-red-600">⚠ kan vara gammal</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(e.id)}
                  aria-label={`Ta bort ${e.filename}`}
                  className="rounded p-1 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 self-end text-[11px] text-muted-foreground/70 underline-offset-2 hover:text-muted-foreground hover:underline"
        >
          rensa alla
        </button>
      )}
    </div>
  );
}

export function RepeaterLoader({
  onFile,
  loadState,
  savedExports,
  onPickSaved,
  onDeleteSaved,
  onClearSaved,
}: {
  onFile: (f: File) => void;
  loadState: Sk6baLoadState;
  savedExports: SavedExport[];
  onPickSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onClearSaved: () => void;
}) {
  const isError = loadState.status === "error";
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-6 cursor-pointer hover:border-foreground/40">
          <span className="text-sm font-medium">Välj fil</span>
          <span className="text-xs text-muted-foreground">SK6BA / Marks repeater-CSV (.csv)</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <p className="mt-auto text-xs text-muted-foreground">
            Sparas automatiskt lokalt så du kan återanvända senare (max 5).
          </p>
        </label>
        <SavedExportsPanel
          items={savedExports}
          onPick={onPickSaved}
          onDelete={onDeleteSaved}
          onClear={onClearSaved}
        />
      </div>
      {isError && (
        <div
          role="alert"
          className="mt-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <div className="font-medium">Kunde inte läsa filen</div>
          <div className="mt-1 text-xs">{loadState.message}</div>
          {loadState.missingColumns && loadState.missingColumns.length > 0 && (
            <div className="mt-2 text-xs">
              <span className="text-muted-foreground">Saknade kolumner:</span>{" "}
              <code className="font-mono">{loadState.missingColumns.join(", ")}</code>
              <div className="mt-1 text-muted-foreground">
                Kontrollera att du exporterat CSV:n från{" "}
                <a
                  href="https://sk6ba.se/vhf/repeater/karta/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  SK6BA:s repeaterkarta
                </a>{" "}
                med standardkolumner.
              </div>
            </div>
          )}
        </div>
      )}
      {loadState.status === "loaded" && (
        <ParseWarningsPanel title="i SK6BA-filen" warnings={loadState.parseWarnings} />
      )}
    </>
  );
}
