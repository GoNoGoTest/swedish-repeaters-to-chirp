import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { parseSk6baCsv, summarize, type Summary } from "@/lib/codeplug/importers/sk6ba";
import { runPipeline } from "@/lib/codeplug/pipeline";
import { listTargets, requireTarget } from "@/lib/codeplug/targets";
import type { ChirpSettings } from "@/lib/codeplug/models";
import type { VgcN76Settings } from "@/lib/codeplug/targets";
import { DEFAULT_SETTINGS, DEFAULT_PACK_NAMING } from "@/lib/codeplug/defaults";
import { loadMergedPacks, type MergedPack } from "@/lib/codeplug/channel_packs/registry";
import { selectPackChannels, type ParsedPackChannel } from "@/lib/codeplug/importers/channel_pack";
import { buildName } from "@/lib/codeplug/naming";
import {
  listSavedExports, saveExport, deleteExport, clearAllExports,
  freshnessOf, relativeTime, formatBytes,
  type SavedExport,
} from "@/lib/codeplug/saved-exports";
import type {
  RawRow, Settings, NormalizedChannel, NamingSettings,
  PackPlacement, FreqDupePolicy, RxOnlyPolicy, PackSelectionEntry, HomeDistrictSort,
  SplitMode, SplitSettings,
} from "@/lib/codeplug/models";
import { isValidMaidenhead } from "@/lib/codeplug/maidenhead";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SK6BA → CHIRP-CSV" },
      { name: "description", content: "Bygg en CHIRP-CSV från Marks Amatörradioklubbs repeaterexport och kombinera fritt med svenska amatörradio- och RX-only-kanalpaket." },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "sk6ba-chirp-settings-v6";

const REPEATER_TOKENS = ["{type}", "{network}", "{band}", "{district}", "{city}", "{channel}", "{call}"];
const PACK_TOKENS = ["{service}", "{category}", "{label}", "{name_hint}", "{channel}", "{band}"];

function download(filename: string, content: string) {
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

function loadStoredSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // v5: export targets are pluggable. Older keys (v4 and below) live under
    // a different STORAGE_KEY and are ignored on purpose — see plan.md.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      naming: { ...DEFAULT_SETTINGS.naming, ...(parsed.naming ?? {}) },
      packs: { ...DEFAULT_SETTINGS.packs, ...(parsed.packs ?? {}) },
      sort: { ...DEFAULT_SETTINGS.sort, ...(parsed.sort ?? {}) },
      export: {
        targetId: parsed?.export?.targetId ?? DEFAULT_SETTINGS.export.targetId,
        perTarget: { ...DEFAULT_SETTINGS.export.perTarget, ...(parsed?.export?.perTarget ?? {}) },
        split: { ...DEFAULT_SETTINGS.export.split, ...(parsed?.export?.split ?? {}) },
      },
    };
  } catch { return DEFAULT_SETTINGS; }
}

function defaultPackEntry(): PackSelectionEntry {
  return { enabled: false, bands: [], categories: [], tags: [], useEnabledDefault: true };
}

function Index() {
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedExports, setSavedExports] = useState<SavedExport[]>([]);
  // Hydratera först efter mount för att undvika SSR/CSR-mismatch.
  useEffect(() => { setSavedExports(listSavedExports()); }, []);
  useEffect(() => {
    setSettings(loadStoredSettings());
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings, settingsHydrated]);

  const packs = useMemo(() => loadMergedPacks(), []);

  // Active export target + its current settings. Targets are pluggable
  // (see src/lib/codeplug/targets/registry.ts). New formats plug in here
  // without UI rewrites — each target may render its own settings panel.
  const target = useMemo(() => requireTarget(settings.export.targetId), [settings.export.targetId]);
  const targetSettings = (settings.export.perTarget[settings.export.targetId] ?? target.defaultSettings) as Record<string, unknown>;
  // Narrow view used by the legacy CHIRP panel. Only safe to read when the
  // active target is "chirp-generic" — guarded by isChirpTarget below.
  const chirpSettings = targetSettings as unknown as ChirpSettings;
  const maxNameLength = target.resolveMaxNameLength
    ? target.resolveMaxNameLength(targetSettings as never)
    : target.limits.maxNameLength;

  const setTargetSettings = useCallback((patch: Record<string, unknown>) => {
    setSettings((prev) => ({
      ...prev,
      export: {
        ...prev.export,
        perTarget: {
          ...prev.export.perTarget,
          [prev.export.targetId]: { ...(prev.export.perTarget[prev.export.targetId] ?? {}) as object, ...patch },
        },
      },
    }));
  }, []);


  // Derive pack channels actually selected (only enabled packs contribute)
  const selectedPackChannels = useMemo<NormalizedChannel[]>(() => {
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

  const loadCsvText = useCallback((text: string) => {
    const r = parseSk6baCsv(text);
    setRows(r.rows); setColumns(r.columns);
    setSummary(summarize(r.rows, r.columns));
    return r.rows.length;
  }, []);

  const onFile = useCallback(async (file: File) => {
    setLoadError(null);
    const text = await file.text();
    try {
      const rowCount = loadCsvText(text);
      saveExport({ filename: file.name, content: text, rowCount });
      setSavedExports(listSavedExports());
    } catch (e) { setLoadError(String(e)); }
  }, [loadCsvText]);

  const onPickSaved = useCallback((id: string) => {
    setLoadError(null);
    const entry = listSavedExports().find((e) => e.id === id);
    if (!entry) return;
    try { loadCsvText(entry.content); } catch (e) { setLoadError(String(e)); }
  }, [loadCsvText]);

  const onDeleteSaved = useCallback((id: string) => {
    deleteExport(id);
    setSavedExports(listSavedExports());
  }, []);

  const onClearSaved = useCallback(() => {
    clearAllExports();
    setSavedExports([]);
  }, []);

  const pipeline = useMemo(() => {
    if (!rows) return null;
    return runPipeline({ sk6baRows: rows, packChannels: selectedPackChannels, settings, maxNameLength });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows,
    selectedPackChannels,
    settings.filter,
    settings.naming,
    settings.packs,
    settings.sort,
    settings.export,
    maxNameLength,
  ]);


  const stats = useMemo(() => {
    if (!pipeline) return null;
    let warned = 0, collided = 0, rxOnly = 0, dupes = 0;
    for (const c of pipeline.channels) {
      if (c.warnings.length) warned++;
      if (c.collided) collided++;
      if (c.rx_only) rxOnly++;
      if (c.warnings.some((w) => w.code === "freq_duplicate")) dupes++;
    }
    return { warned, collided, rxOnly, dupes };
  }, [pipeline]);

  const split = settings.export.split;
  const willSplit = split.mode !== "single" && !!target.exportMany;

  const doExport = async () => {
    if (!pipeline || pipeline.duplicateStop) return;
    if (willSplit && target.exportMany) {
      const files = target.exportMany(pipeline.channels, targetSettings as never, split);
      if (files.length === 1) {
        download(files[0].filename, files[0].content);
      } else {
        const base = target.filenameBase ?? target.id;
        await downloadZip(`${base}.zip`, files);
      }
      return;
    }
    const result = target.export(pipeline.channels, targetSettings as never);
    download(result.filename, result.content);
  };


  const exportReport = () => {
    if (!pipeline) return;
    const reportRows = pipeline.channels
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
    download("varningar.csv", csv);
  };

  const enabledPackCount = useMemo(
    () => Object.values(settings.packs.selection).filter((s) => s.enabled).length,
    [settings.packs.selection],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 py-5">
          <h1 className="font-mono text-xl font-semibold tracking-tight">sk6ba → chirp.csv</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Två oberoende källor — repeatrar från SK6BA/Marks och valfria kanalpaket — kombineras till en CHIRP-importerbar CSV. Allt sker lokalt i din webbläsare.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className={pipeline ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}>
          <div className="space-y-6 min-w-0">

            {/* ───────────── REPEATERSEKTION ───────────── */}
            <Section
              title="Repeatrar (SK6BA / Marks-CSV)"
              subtitle="Repeatrar, länkar och hotspots från en CSV-export. Egna namngivnings- och filterregler."
            >
              {!rows && (
                <RepeaterLoader
                  onFile={onFile}
                  loadError={loadError}
                  savedExports={savedExports}
                  onPickSaved={onPickSaved}
                  onDeleteSaved={onDeleteSaved}
                  onClearSaved={onClearSaved}
                />
              )}

              {rows && summary && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {summary.totalRows} rader · {summary.columns.length} kolumner
                    </div>
                    <button onClick={() => { setRows(null); setSummary(null); }}
                      className="text-xs text-muted-foreground underline">Byt fil</button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 text-sm">
                    <Stat label="Rader" value={summary.totalRows} />
                    <Stat label="Saknad output" value={summary.missingOutput} />
                    <Stat label="Saknade koord." value={summary.missingCoords} />
                    <Stat label="Oklar tx_shift" value={summary.unclearShift} />
                    <Stat label="Saknar CTCSS" value={summary.missingTone} />
                    <Stat label="Distrikt" value={Object.keys(summary.uniqueCounts.district).length} />
                  </div>

                  <RepeaterFilterPanel summary={summary} settings={settings} setSettings={setSettings} />

                  <div className="border-t border-border pt-4">
                    <SectionLabel>Namngivning av repeatrar</SectionLabel>
                    <NamingEditor
                      value={settings.naming}
                      onChange={(n) => setSettings({ ...settings, naming: n })}
                      tokens={REPEATER_TOKENS}
                      hint="Repeaterrader får sitt namn via dessa tokens. Tomma tokens droppas och dubbla separatorer undviks."
                      previewKind="repeater"
                      maxLength={maxNameLength}
                    />
                  </div>
                </div>
              )}
            </Section>

            {/* ───────────── KANALPAKETSSEKTION ───────────── */}
            <Section
              title="Kanalpaket"
              subtitle="Fasta kanaler från CSV-paket i /channelpacks (amatör simplex, marin VHF, PMR446 m.fl.). Varje paket har egna inställningar och egen namngivning."
            >
              <ChannelPacksPanel
                packs={packs}
                settings={settings}
                setSettings={setSettings}
                selectedPackCount={enabledPackCount}
                selectedChannelCount={selectedPackChannels.length}
                maxNameLength={maxNameLength}
              />
            </Section>

            {/* ───────────── EXPORT / SORTERING / CHIRP ───────────── */}
            {rows && (
              <Section
                title="Sortering & export"
                subtitle="Hur de kombinerade kanalerna ordnas i radions minne och vilket exportformat som används."
              >
                <ExportPanel
                  settings={settings} setSettings={setSettings}
                  hasPacks={enabledPackCount > 0}
                  chirpSettings={chirpSettings}
                  targetSettings={targetSettings}
                  setTargetSettings={setTargetSettings}
                />
              </Section>
            )}
          </div>

          {/* ───────────── PREVIEW (sticky on xl) ───────────── */}
          {pipeline && (
            <div className="min-w-0">
              <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
                <Section title="Förhandsgranska & exportera" right={
                  <div className="flex gap-2">
                    <button onClick={exportReport}
                      className="rounded border border-border px-3 py-1.5 text-xs">Varningar</button>
                    <button onClick={doExport}
                      disabled={pipeline.duplicateStop}
                      className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                      Exportera {target.label} ({pipeline.channels.length})
                    </button>
                  </div>
                }>
                  {pipeline.duplicateStop && (
                    <div role="alert" className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      Export stoppad — frekvensdubbletter enligt policy. Ändra policy eller åtgärda dubbletter.
                    </div>
                  )}
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-5 text-sm mb-3">
                    <Stat label="Input totalt" value={pipeline.totalInput} />
                    <Stat label="SK6BA" value={pipeline.sk6baCount} />
                    <Stat label="Kanalpaket" value={pipeline.packCount} />
                    <Stat label="Filtrerade bort" value={pipeline.filteredOut} />
                    <Stat label="Varn/Koll/Dupes/RX" value={`${stats?.warned ?? 0}/${stats?.collided ?? 0}/${stats?.dupes ?? 0}/${stats?.rxOnly ?? 0}`} />
                  </div>
                  {pipeline && target.validate && (() => {
                    const tw = target.validate!(pipeline.channels, targetSettings as never);
                    if (tw.length === 0) return null;
                    return (
                      <ul className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        {tw.map((w, i) => <li key={i}>⚠ {w.message}</li>)}
                      </ul>
                    );
                  })()}
                  <PreviewTable channels={pipeline.channels} chirpMode={target.id === "chirp-generic" ? chirpSettings.mode : "NFM"} startLoc={target.id === "chirp-generic" ? chirpSettings.startLocation : 1} />
                </Section>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-[1600px] px-6 py-4 text-xs text-muted-foreground">
          Verktyget skapar CHIRP-CSV — öppna den i CHIRP och importera till din radioimage. Digitala moder stöds inte i v1.
        </div>
      </footer>
    </div>
  );
}


/* ═══════════════════════════════ HELPERS ═══════════════════════════════ */

function Section({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{children}</div>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{children}</p>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono" />
    </Field>
  );
}

function MultiSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`rounded border px-2 py-0.5 text-xs font-mono ${on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}>
              {o || "(tom)"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Repeater loader ───────────── */

function RepeaterLoader({ onFile, loadError, savedExports, onPickSaved, onDeleteSaved, onClearSaved }: {
  onFile: (f: File) => void;
  loadError: string | null;
  savedExports: SavedExport[];
  onPickSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onClearSaved: () => void;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-6 cursor-pointer hover:border-foreground/40">
          <span className="text-sm font-medium">Välj fil</span>
          <span className="text-xs text-muted-foreground">SK6BA / Marks repeater-CSV (.csv)</span>
          <input type="file" accept=".csv,text/csv" className="text-sm"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <p className="mt-auto text-xs text-muted-foreground">Sparas automatiskt lokalt så du kan återanvända senare (max 5).</p>
        </label>
        <SavedExportsPanel
          items={savedExports}
          onPick={onPickSaved}
          onDelete={onDeleteSaved}
          onClear={onClearSaved}
        />
      </div>
      {loadError && <p className="mt-3 text-sm text-destructive">{loadError}</p>}
    </>
  );
}

const FRESHNESS_DOT: Record<"fresh" | "stale" | "old", string> = {
  fresh: "bg-emerald-500",
  stale: "bg-amber-500",
  old: "bg-red-500",
};

function SavedExportsPanel({ items, onPick, onDelete, onClear }: {
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
          Ingen sparad än. Filer du laddar upp dyker upp här så du kan välja
          dem direkt nästa gång.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((e) => {
            const f = freshnessOf(e.savedAt);
            return (
              <li key={e.id} className="group flex items-center gap-3 py-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${FRESHNESS_DOT[f]}`}
                  aria-label={f === "fresh" ? "färsk" : f === "stale" ? "några veckor" : "kan vara gammal"}
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

/* ───────────── Repeater filter ───────────── */

function RepeaterFilterPanel({ summary, settings, setSettings }: {
  summary: Summary; settings: Settings; setSettings: (s: Settings) => void;
}) {
  const allStatuses = Object.keys(summary.uniqueCounts.status);
  const allTypes = Object.keys(summary.uniqueCounts.type);
  const allBands = Object.keys(summary.uniqueCounts.band);
  const allDistricts = Object.keys(summary.uniqueCounts.district).filter((d) => /^\d+$/.test(d));
  const upd = (patch: Partial<Settings["filter"]>) => setSettings({ ...settings, filter: { ...settings.filter, ...patch } });

  return (
    <div>
      <SectionLabel>Filter</SectionLabel>
      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelect label="Status" options={allStatuses} value={settings.filter.statuses} onChange={(v) => upd({ statuses: v })} />
        <MultiSelect label="Typ" options={allTypes} value={settings.filter.types} onChange={(v) => upd({ types: v })} />
        <MultiSelect label="Band" options={allBands} value={settings.filter.bands} onChange={(v) => upd({ bands: v })} />
        <MultiSelect label="Distrikt (tomt = alla svenska)" options={allDistricts} value={settings.filter.districts} onChange={(v) => upd({ districts: v })} />
      </div>
      <div className="grid gap-4 md:grid-cols-3 mt-3">
        <Field label="Mode-strategi">
          <select value={settings.filter.modeStrategy}
            onChange={(e) => upd({ modeStrategy: e.target.value as Settings["filter"]["modeStrategy"] })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
            <option value="contains_fm">Mode innehåller FM</option>
            <option value="exact_fm">Exakt FM</option>
            <option value="all">Alla rader</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={settings.filter.includeUnknownDistricts}
            onChange={(e) => upd({ includeUnknownDistricts: e.target.checked })} />
          Inkludera utländska/okända distrikt
        </label>
      </div>
    </div>
  );
}

/* ───────────── Naming editor (shared between repeater + per-pack) ───────────── */

const REPEATER_EXAMPLES: Partial<NormalizedChannel>[] = [
  { source_type: "sk6ba", type: "Repeater", network: "", band: "2", district: "6", city: "Borås", call: "SK6BA", channel: "RV48" },
  { source_type: "sk6ba", type: "Repeater", network: "SvxLink", band: "70", district: "6", city: "Örnsköldsvik", call: "SK6RJW", channel: "RU368" },
  { source_type: "sk6ba", type: "Link", network: "", band: "2", district: "3", city: "Östersund/Frösön", call: "SM3XYZ", channel: "RV56" },
];

const PACK_EXAMPLES: Partial<NormalizedChannel>[] = [
  { source_type: "channel_pack", service: "PMR446", category: "Simplex", label: "PMR 1", name_hint: "PMR1", channel: "1", band: "70" },
  { source_type: "channel_pack", service: "Marine VHF", category: "Duplex", label: "M16", name_hint: "M16", channel: "16", band: "2" },
  { source_type: "channel_pack", service: "Amateur 2m", category: "Simplex", label: "Calling", name_hint: "S20", channel: "S20", band: "2" },
];

function makeExampleChannel(over: Partial<NormalizedChannel>): NormalizedChannel {
  return {
    source_type: "sk6ba", source_row: 0, source_id: "ex",
    type: "Repeater", status: "QRV", mode_raw: "FM", is_analog_fm: true,
    band: "", district: "", city: "", call: "", channel: "",
    network: "", network_id: "", access_raw: "",
    rx_frequency: null, tx_shift_raw: "", tx_shift: null, shift_unclear: false,
    duplex: "", offset: 0, ctcss_tx: null, uses_1750: false,
    lat: null, lng: null, locator: "", comment: "",
    pack_id: "", service: "", category: "", tags: [],
    label: "", name_hint: "",
    tx_frequency: null, mode_chirp: "", tstep: null,
    tone_raw: "", rtone_freq: null, ctone_freq: null,
    dtcs_code: "", dtcs_polarity: "", skip_raw: "",
    tx_allowed: true, rx_only: false,
    license_note: "", source: "", source_url: "",
    inferred_from_range: false,
    generated_name_full: "", generated_name_final: "",
    collided: false, warnings: [],
    ...over,
  };
}

function NamingPreview({ naming, kind, maxLength, sampleChannels }: {
  naming: NamingSettings;
  kind: "repeater" | "pack";
  maxLength: number;
  sampleChannels?: NormalizedChannel[];
}) {
  const examples = useMemo(() => {
    if (sampleChannels && sampleChannels.length > 0) {
      // Pick up to 3 spread-out samples (first, middle, last) for variety.
      const n = sampleChannels.length;
      const idxs = n <= 3 ? Array.from({ length: n }, (_, i) => i)
        : [0, Math.floor(n / 2), n - 1];
      return idxs.map((i) => {
        const ch = sampleChannels[i];
        const { full, clipped } = buildName(ch, naming, maxLength);
        const label = `${ch.service || ""} ${ch.name_hint || ch.channel || ch.label || ""}`.trim().slice(0, 24) || "—";
        return { label, full, clipped };
      });
    }
    const seeds = kind === "repeater" ? REPEATER_EXAMPLES : PACK_EXAMPLES;
    return seeds.map((seed) => {
      const ch = makeExampleChannel(seed);
      const { full, clipped } = buildName(ch, naming, maxLength);
      const label = kind === "repeater"
        ? `${seed.city || seed.call || "?"}${seed.channel ? `/${seed.channel}` : ""}`
        : `${seed.service || ""} ${seed.name_hint || seed.label || ""}`.trim();
      return { label, full, clipped };
    });
  }, [naming, kind, maxLength, sampleChannels]);
  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-1">Förhandsvisning (max {maxLength} tecken)</div>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex, i) => (
          <div key={i} className="rounded border border-border bg-muted/40 px-2 py-1">
            <div className="text-[10px] text-muted-foreground leading-tight">{ex.label}</div>
            <div className="font-mono text-xs leading-tight" title={ex.full !== ex.clipped ? `Full: ${ex.full}` : undefined}>
              {ex.clipped || <span className="italic text-muted-foreground">(tom)</span>}
              {ex.full !== ex.clipped && <span className="text-muted-foreground"> ✂</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function NamingEditor({ value, onChange, tokens, hint, previewKind, maxLength, showCityMaxLength = true, sampleChannels }: {
  value: NamingSettings; onChange: (n: NamingSettings) => void;
  tokens: string[]; hint?: string; previewKind?: "repeater" | "pack";
  maxLength: number;
  showCityMaxLength?: boolean;
  sampleChannels?: NormalizedChannel[];
}) {
  const upd = (patch: Partial<NamingSettings>) => onChange({ ...value, ...patch });
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Komponenter (klicka för att lägga till/ta bort, i tur och ordning)</div>
          <div className="flex flex-wrap gap-1 mb-2 min-h-[28px]">
            {value.components.map((t, i) => (
              <button key={`${t}-${i}`} type="button"
                onClick={() => upd({ components: value.components.filter((_, j) => j !== i) })}
                className="rounded border border-primary bg-primary px-2 py-0.5 text-xs font-mono text-primary-foreground">
                {t} ×
              </button>
            ))}
            {value.components.length === 0 && <span className="text-xs text-muted-foreground italic">Inga komponenter — kanalens fallback (name_hint / channel / label) används.</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {tokens.map((t) => (
              <button key={t} type="button"
                onClick={() => upd({ components: [...value.components, t] })}
                className="rounded border border-border px-2 py-0.5 text-xs font-mono">
                + {t}
              </button>
            ))}
          </div>
          {hint && <Hint>{hint}</Hint>}
        </div>
        <div className="space-y-2">
          {showCityMaxLength && (
            <NumberField label="Max längd ort" value={value.cityMaxLength} onChange={(v) => upd({ cityMaxLength: v })} />
          )}
          <Field label="Separator" hint="Tecken mellan tokens. Default: -">
            <input value={value.separator}
              onChange={(e) => upd({ separator: e.target.value })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono" placeholder="-" />
          </Field>
        </div>
        <div className="md:col-span-3 grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.transliterate}
              onChange={(e) => upd({ transliterate: e.target.checked })} />
            Translitterera svenska tecken (Å→A, Ä→A, Ö→O)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.uppercase}
              onChange={(e) => upd({ uppercase: e.target.checked })} />
            VERSALER
          </label>
          <Field label="Vid namnkollision">
            <select value={value.collisionPolicy}
              onChange={(e) => upd({ collisionPolicy: e.target.value as NamingSettings["collisionPolicy"] })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
              <option value="numeric_suffix">Numeriskt suffix (1, 2, 3…)</option>
              <option value="last_char_suffix">Bokstavssuffix (A, B, C…)</option>
              <option value="stop">Stoppa export</option>
            </select>
          </Field>
        </div>
      </div>
      {previewKind && <NamingPreview naming={value} kind={previewKind} maxLength={maxLength} sampleChannels={sampleChannels} />}
    </div>
  );
}



/* ───────────── Channel packs panel ───────────── */

function ChannelPacksPanel({
  packs, settings, setSettings, selectedPackCount, selectedChannelCount, maxNameLength,
}: {
  packs: MergedPack[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  selectedPackCount: number;
  selectedChannelCount: number;
  maxNameLength: number;
}) {
  const updPack = (packId: string, patch: Partial<PackSelectionEntry>) => {
    const cur = settings.packs.selection[packId] ?? defaultPackEntry();
    setSettings({
      ...settings,
      packs: { ...settings.packs, selection: { ...settings.packs.selection, [packId]: { ...cur, ...patch } } },
    });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {packs.length} paket tillgängliga · {selectedPackCount} valda · {selectedChannelCount} kanaler kommer läggas till.
        Klicka på ett paket för att fälla ut bands-/kategorifilter och egen namngivning.
      </div>
      {packs.map((pack) => (
        <PackRow key={pack.packId} pack={pack}
          entry={settings.packs.selection[pack.packId]}
          maxLength={maxNameLength}
          onChange={(patch) => updPack(pack.packId, patch)} />
      ))}
    </div>
  );
}

function PackRow({ pack, entry, maxLength, onChange }: {
  pack: MergedPack;
  entry: PackSelectionEntry | undefined;
  maxLength: number;
  onChange: (patch: Partial<PackSelectionEntry>) => void;
}) {
  const [open, setOpen] = useState(false);
  const sel: PackSelectionEntry = entry ?? defaultPackEntry();
  const enabled = sel.enabled;

  const bands = useMemo(() => Array.from(new Set(pack.channels.map((c) => c.band).filter(Boolean))).sort(), [pack]);
  const categories = useMemo(() => Array.from(new Set(pack.channels.map((c) => c.category).filter(Boolean))).sort(), [pack]);
  const tags = useMemo(() => Array.from(new Set(pack.channels.flatMap((c) => c.tags))).sort(), [pack]);
  const services = Array.from(new Set(pack.channels.map((c) => c.service).filter(Boolean))).join(", ");
  const enabledDefaultCount = pack.channels.filter((c) => c.enabled_default).length;
  const allRxOnly = pack.channels.every((c) => c.rx_only);

  const naming = sel.naming ?? DEFAULT_PACK_NAMING;

  return (
    <div className={`rounded border ${enabled ? "border-primary/50" : "border-border"} bg-background`}>
      <div className="flex items-center gap-3 p-3">
        <input type="checkbox" checked={enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="h-4 w-4" />
        <button type="button" onClick={() => setOpen(!open)} className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{pack.packId}</span>
            {allRxOnly && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">RX-only</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {pack.channels.length} rader · {services || "—"} · {pack.fileNames.join(", ")}
          </div>
        </button>
        <button type="button" onClick={() => setOpen(!open)}
          className="text-xs text-muted-foreground">{open ? "Dölj ▲" : "Inställningar ▼"}</button>
      </div>

      {open && (
        <div className="border-t border-border p-3 space-y-4">
          <div>
            <SectionLabel>Vilka kanaler från paketet</SectionLabel>
            <div className="grid gap-3 md:grid-cols-3">
              {bands.length > 0 && <MultiSelect label="Band" options={bands} value={sel.bands} onChange={(v) => onChange({ bands: v })} />}
              {categories.length > 0 && <MultiSelect label="Kategori" options={categories} value={sel.categories} onChange={(v) => onChange({ categories: v })} />}
              {tags.length > 0 && <MultiSelect label="Tag" options={tags} value={sel.tags} onChange={(v) => onChange({ tags: v })} />}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" checked={sel.useEnabledDefault}
                onChange={(e) => onChange({ useEnabledDefault: e.target.checked })} />
              Bara rader paketet markerat som <code>enabled_default=true</code> ({enabledDefaultCount} rader). Tomt band/kategori/tag = alla.
            </label>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Namngivning för detta paket</SectionLabel>
              {sel.naming && (
                <button type="button" onClick={() => onChange({ naming: undefined })}
                  className="text-xs text-muted-foreground underline">Återställ till standard</button>
              )}
            </div>
            <NamingEditor
              value={naming}
              onChange={(n) => onChange({ naming: n })}
              tokens={PACK_TOKENS}
              hint={`Standard: \`{name_hint}\`, max ${maxLength} tecken — funkar för t.ex. "S20", "PMR1", "M16". Skriv egen mall om paketet kräver annat.`}
              previewKind="pack"
              maxLength={maxLength}
              showCityMaxLength={false}
              sampleChannels={pack.channels}
            />

          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Export / CHIRP / sortering ───────────── */

function ExportPanel({ settings, setSettings, hasPacks, chirpSettings, targetSettings, setTargetSettings }: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  hasPacks: boolean;
  chirpSettings: ChirpSettings;
  targetSettings: Record<string, unknown>;
  setTargetSettings: (patch: Record<string, unknown>) => void;
}) {
  const updPacks = (patch: Partial<Settings["packs"]>) => setSettings({ ...settings, packs: { ...settings.packs, ...patch } });
  const updChirp = (patch: Partial<ChirpSettings>) => setTargetSettings(patch as Record<string, unknown>);
  const updSort = (patch: Partial<Settings["sort"]>) => setSettings({ ...settings, sort: { ...settings.sort, ...patch } });

  const targets = listTargets();
  const setTargetId = (id: string) => {
    const t = requireTarget(id);
    setSettings({
      ...settings,
      export: {
        targetId: id,
        perTarget: {
          ...settings.export.perTarget,
          [id]: settings.export.perTarget[id] ?? { ...(t.defaultSettings as object) },
        },
      },
    });
  };


  return (
    <div className="space-y-5">
      {hasPacks && (
        <div>
          <SectionLabel>Var hamnar kanalpaketen?</SectionLabel>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Placering i CHIRP-listan">
              <div className="flex flex-wrap gap-1">
                {([
                  ["prepend","I början"],
                  ["append","I slutet"],
                  ["off","Inte med alls"],
                ] as Array<[PackPlacement,string]>).map(([k,label]) => (
                  <button key={k} type="button" onClick={() => updPacks({ placement: k })}
                    className={`rounded border px-2 py-1 text-xs ${settings.packs.placement === k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <Hint>Repeatrar sorteras alltid efter sorteringsordningen nedan. Kanalpaketen ligger i den ordning de står i CSV:n.</Hint>
            </Field>
            <Field label="Frekvensdubblett mellan paket och repeatrar" hint="Vad ska hända om en paketkanal har samma RX-frekvens som en repeater?">
              <select value={settings.packs.freqDupePolicy}
                onChange={(e) => updPacks({ freqDupePolicy: e.target.value as FreqDupePolicy })}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
                <option value="keep_both">Behåll båda</option>
                <option value="drop_pack">Hoppa över paket-raden</option>
                <option value="drop_sk6ba">Hoppa över repeater-raden</option>
                <option value="stop">Stoppa export</option>
              </select>
            </Field>
            <Field label="RX-only-kanaler (t.ex. marin VHF, airband)" hint="Hur ska kanaler markerade som mottagning-bara hanteras vid export?">
              <select value={settings.packs.rxOnlyPolicy}
                onChange={(e) => updPacks({ rxOnlyPolicy: e.target.value as RxOnlyPolicy })}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
                <option value="duplex_off">Exportera som Duplex=off (rekommenderas)</option>
                <option value="mark">Exportera normalt + markera RX-ONLY i Comment</option>
                <option value="skip">Hoppa över helt</option>
                <option value="stop">Stoppa export</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <QthHomeDistrictPanel settings={settings} updSort={updSort} />
      </div>

      <div className="border-t border-border pt-4">
        <SectionLabel>Sorteringsordning för repeatrar (fallback)</SectionLabel>
        <Hint>
          Används när inget hemdistrikt är valt ovan. Klicka för att lägga till/ta bort en sorteringsnyckel. Ordningen styr prioritet.
        </Hint>
        <div className="flex flex-wrap gap-1 mt-2">
          {(["district","geohash","type","city","frequency"] as const).map((k) => {
            const idx = settings.sort.keys.indexOf(k);
            const on = idx !== -1;
            return (
              <button key={k} type="button"
                onClick={() => {
                  const keys = on ? settings.sort.keys.filter((x) => x !== k) : [...settings.sort.keys, k];
                  updSort({ keys });
                }}
                className={`rounded border px-2 py-0.5 text-xs font-mono ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                {on ? `${idx + 1}. ${k}` : k}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <SectionLabel>Exportmål</SectionLabel>
        <Hint>
          Välj vilket app- eller radiospecifikt format CSV-filen ska skrivas i. Nya format läggs till i <code className="font-mono">src/lib/codeplug/targets/</code>.
        </Hint>
        <div className="mt-2">
          <select value={settings.export.targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-sm">
            {Object.entries(
              targets.reduce<Record<string, typeof targets>>((acc, t) => {
                (acc[t.vendor] ||= []).push(t); return acc;
              }, {}),
            ).map(([vendor, group]) => (
              <optgroup key={vendor} label={vendor}>
                {group.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {settings.export.targetId === "chirp-generic" && (
        <div className="border-t border-border pt-4">
          <SectionLabel>CHIRP-fält & radio</SectionLabel>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <NumberField label="Startnummer (Location)" value={chirpSettings.startLocation}
              onChange={(v) => updChirp({ startLocation: v })}
              hint="Första minnesposition i radion. T.ex. 1 om du vill skriva från början, 100 om du vill lägga repeatrarna efter befintliga kanaler." />
            <NumberField label="Max längd kanalnamn" value={chirpSettings.maxLength}
              onChange={(v) => updChirp({ maxLength: v })}
              hint="Hårdvarubegränsning — många radior trunkerar vid 6–7 tecken. Gäller alla kanaler (både repeatrar och paket)." />
            <Field label="Mode" hint="NFM = smal FM (12,5 kHz) — standard för amatörradio idag. FM = bred (25 kHz), äldre repeatrar.">
              <select value={chirpSettings.mode}
                onChange={(e) => updChirp({ mode: e.target.value as ChirpSettings["mode"] })}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
                <option value="NFM">NFM (smal FM)</option>
                <option value="FM">FM (bred)</option>
              </select>
            </Field>
            <NumberField label="TStep (kHz)" step={0.5} value={chirpSettings.tStep}
              onChange={(v) => updChirp({ tStep: v })}
              hint="Frekvensraster vid manuell rattning på radion. 5 kHz funkar för 2m/70cm i Sverige. PMR/marin sätter eget per kanal." />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={chirpSettings.skipLinks}
              onChange={(e) => updChirp({ skipLinks: e.target.checked })} />
            Hoppa över länkar och hotspots vid skanning i radion
            <span className="text-xs text-muted-foreground">(sätter Skip=S på Link/Hotspot — kanalen finns kvar men skannas inte)</span>
          </label>
        </div>
      )}

      {settings.export.targetId === "vgc-n76" && (
        <VgcN76Panel
          settings={targetSettings as unknown as VgcN76Settings}
          update={setTargetSettings}
        />
      )}
    </div>
  );
}

/* ───────────── VGC N76 panel ───────────── */

function VgcN76Panel({ settings, update }: {
  settings: VgcN76Settings;
  update: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="border-t border-border pt-4">
      <SectionLabel>VGC N76-fält</SectionLabel>
      <Hint>
        VGC:s iOS/Android-app importerar denna CSV direkt — inga andra verktyg behövs. Frekvenser skrivs i Hz, CTCSS som Hz×100, DCS som decimal-form av oktal-koden. DCS-polaritet (N/I) går inte att uttrycka i filen och defaultas till N.
      </Hint>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5 mt-2">
        <NumberField label="Max längd title" value={settings.maxLength}
          onChange={(v) => update({ maxLength: v })}
          hint="N76 visar 16 tecken. Längre namn trunkeras och flaggas som varning." />
        <Field label="Default sändareffekt" hint="H/M/L. Per-rad-override stöds inte i v1.">
          <select value={settings.defaultPower}
            onChange={(e) => update({ defaultPower: e.target.value as VgcN76Settings["defaultPower"] })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
            <option value="H">H (hög)</option>
            <option value="M">M (medel)</option>
            <option value="L">L (låg)</option>
          </select>
        </Field>
        <Field label="Default bandbredd" hint="Används när kanalpaket inte anger NFM/FM. 12500 = smal, 25000 = bred.">
          <select value={settings.defaultBandwidth}
            onChange={(e) => update({ defaultBandwidth: Number(e.target.value) as VgcN76Settings["defaultBandwidth"] })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
            <option value={12500}>12500 (NFM)</option>
            <option value={25000}>25000 (FM)</option>
          </select>
        </Field>
        <NumberField label="Kanaler per grupp" value={settings.channelsPerGroup}
          onChange={(v) => update({ channelsPerGroup: v })}
          hint="N76 grupperar i klumpar om 32. Överskrids gränsen visas en varning — uppdelning sker manuellt i v1." />
        <NumberField label="Padda till antal rader" value={settings.padToChannels ?? 0}
          onChange={(v) => update({ padToChannels: v > 0 ? v : null })}
          hint="0 = ingen padding. Sätt t.ex. 32 om appens template kräver fast längd." />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={settings.skipLinks}
          onChange={(e) => update({ skipLinks: e.target.checked })} />
        Hoppa över länkar och hotspots vid skanning
        <span className="text-xs text-muted-foreground">(sätter scan=0 på Link/Hotspot-rader)</span>
      </label>
    </div>
  );
}

/* ───────────── QTH + home district ───────────── */

function QthHomeDistrictPanel({ settings, updSort }: {
  settings: Settings; updSort: (patch: Partial<Settings["sort"]>) => void;
}) {
  const qth = settings.sort.qth_maidenhead ?? "";
  const qthValid = qth === "" || isValidMaidenhead(qth);
  const home = settings.sort.home_district ?? "";
  const sortMode = settings.sort.home_district_sort;
  const hasQth = qth !== "" && qthValid;

  return (
    <div>
      <SectionLabel>QTH och hemdistrikt (för repeatersortering)</SectionLabel>
      <Hint>
        När hemdistrikt är valt sorteras dess repeatrar enligt valet nedan. Övriga distrikt grupperas geohash-mässigt
        i nummerordning (SM1, SM2, … SM7). Påverkar inte kanalpaket.
      </Hint>
      <div className="grid gap-3 md:grid-cols-4 mt-3">
        <Field label="QTH (Maidenhead-lokator)" hint="6 tecken rek., t.ex. JO67bp. Tomt = ingen distanssortering.">
          <input
            value={qth}
            placeholder="JO67bp"
            onChange={(e) => updSort({ qth_maidenhead: e.target.value })}
            className={`w-full rounded border px-2 py-1 text-sm font-mono ${
              qthValid ? "border-input bg-background" : "border-destructive bg-destructive/5"
            }`}
          />
          {!qthValid && <Hint>Ogiltig lokator (förväntar t.ex. JO67 eller JO67bp).</Hint>}
        </Field>
        <Field label="Hemdistrikt" hint="Distrikt vars repeatrar sorteras separat.">
          <select
            value={home}
            onChange={(e) => updSort({ home_district: e.target.value || null })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono"
          >
            <option value="">(inget — använd fallback nedan)</option>
            {["0","1","2","3","4","5","6","7"].map((d) => (
              <option key={d} value={d}>SM{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Sortering inom hemdistrikt">
          <div className="flex flex-col gap-1">
            {([
              ["distance","Avstånd från QTH"],
              ["geohash","Geohash (regional)"],
              ["alphabetical","Alfabetiskt"],
            ] as Array<[HomeDistrictSort,string]>).map(([k,label]) => {
              const disabled = k === "distance" && !hasQth;
              return (
                <label key={k} className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : ""}`}
                  title={disabled ? "Kräver giltig QTH-lokator" : ""}>
                  <input
                    type="radio"
                    name="home_district_sort"
                    checked={sortMode === k}
                    disabled={disabled}
                    onChange={() => updSort({ home_district_sort: k })}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </Field>
        <Field label="Placering">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sort.home_district_first}
              onChange={(e) => updSort({ home_district_first: e.target.checked })}
            />
            Visa hemdistrikt först
          </label>
          <Hint>Avmarkera för att lägga hemdistriktet sist istället.</Hint>
        </Field>
      </div>
    </div>
  );
}

function PreviewTable({ channels, chirpMode, startLoc }: { channels: NormalizedChannel[]; chirpMode: string; startLoc: number }) {
  const shown = channels.slice(0, 300);
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="min-w-full text-xs font-mono">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {["#","Loc","Källa","Namn (full → final)","Freq","Dpx","Off","Tone","Mode","Type/Net/Kat","Plats / Label","Tags","Comment","⚠"].map((h) => (
              <th key={h} className="px-2 py-1 text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((c, i) => {
            const isPack = c.source_type === "channel_pack";
            const rowClass = c.warnings.length ? "bg-destructive/5" : isPack ? "bg-primary/5" : "";
            const mode = isPack && c.mode_chirp ? c.mode_chirp : chirpMode;
            return (
              <tr key={`${c.source_type}-${c.source_row}-${c.source_id}-${i}`} className={`border-t border-border ${rowClass}`}>
                <td className="px-2 py-1 text-muted-foreground">{c.source_row}</td>
                <td className="px-2 py-1">{startLoc + i}</td>
                <td className="px-2 py-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${isPack ? "bg-primary/20 text-primary" : "bg-muted text-foreground"}`}>
                    {isPack ? `PACK · ${c.pack_id}` : "SK6BA"}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <div className="text-muted-foreground">{c.generated_name_full}</div>
                  <div className={c.collided ? "text-amber-500" : ""}>{c.generated_name_final}</div>
                </td>
                <td className="px-2 py-1">{c.rx_frequency?.toFixed(4)}</td>
                <td className="px-2 py-1">{c.duplex || "—"}</td>
                <td className="px-2 py-1">{c.duplex === "split" && c.tx_frequency != null ? c.tx_frequency.toFixed(4) : c.offset.toFixed(3)}</td>
                <td className="px-2 py-1">{c.ctcss_tx ?? (c.uses_1750 ? "1750" : "—")}</td>
                <td className="px-2 py-1">{mode}</td>
                <td className="px-2 py-1 truncate max-w-[10rem]">
                  {isPack ? `${c.service || "?"} / ${c.category || "?"}` : `${c.type}${c.network ? `/${c.network}` : ""}`}
                </td>
                <td className="px-2 py-1 truncate max-w-[10rem]">
                  {isPack ? `${c.label || ""} ${c.channel ? `(${c.channel})` : ""}`.trim() || c.name_hint : c.city}
                  {c.rx_only && <span className="ml-1 rounded bg-destructive/20 px-1 text-[9px] text-destructive">RX</span>}
                  {c.inferred_from_range && <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-700 dark:text-amber-300">INF</span>}
                </td>
                <td className="px-2 py-1 truncate max-w-[10rem] text-muted-foreground">{c.tags.join(", ")}</td>
                <td className="px-2 py-1 truncate max-w-[14rem] text-muted-foreground" title={c.license_note || c.comment}>{c.comment}</td>
                <td className="px-2 py-1">{c.warnings.length ? <span title={c.warnings.map((w) => w.message).join("; ")} className="text-amber-500">!{c.warnings.length}</span> : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {channels.length > shown.length && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
          Visar {shown.length} av {channels.length} rader. Exporten innehåller alla.
        </div>
      )}
    </div>
  );
}

