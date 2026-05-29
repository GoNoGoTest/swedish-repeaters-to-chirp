import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { parseSk6baCsv, summarize, type Summary } from "@/lib/chirp/importers/sk6ba";
import { runPipeline } from "@/lib/chirp/pipeline";
import { exportChirpCsv } from "@/lib/chirp/exporters/chirp";
import { DEFAULT_SETTINGS, DEFAULT_PACK_NAMING } from "@/lib/chirp/defaults";
import { loadMergedPacks, type MergedPack } from "@/lib/chirp/channel_packs/registry";
import { selectPackChannels, type ParsedPackChannel } from "@/lib/chirp/importers/channel_pack";
import type {
  RawRow, Settings, NormalizedChannel, NamingSettings,
  PackPlacement, FreqDupePolicy, RxOnlyPolicy, PackSelectionEntry,
} from "@/lib/chirp/models";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SK6BA → CHIRP-CSV" },
      { name: "description", content: "Bygg en CHIRP-CSV från Marks Amatörradioklubbs repeaterexport och kombinera fritt med svenska amatörradio- och RX-only-kanalpaket." },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "sk6ba-chirp-settings-v3";

const REPEATER_TOKENS = ["{type}", "{network}", "{band}", "{district}", "{city}", "{channel}", "{call}"];
const PACK_TOKENS = ["{service}", "{category}", "{label}", "{name_hint}", "{channel}", "{band}"];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
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
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      naming: { ...DEFAULT_SETTINGS.naming, ...(parsed.naming ?? {}) },
      packs: { ...DEFAULT_SETTINGS.packs, ...(parsed.packs ?? {}) },
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
  const [settings, setSettings] = useState<Settings>(() => loadStoredSettings());
  const [urlInput, setUrlInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const packs = useMemo(() => loadMergedPacks(), []);

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

  const onFile = useCallback(async (file: File) => {
    setLoadError(null);
    const text = await file.text();
    try {
      const r = parseSk6baCsv(text);
      setRows(r.rows); setColumns(r.columns);
      setSummary(summarize(r.rows, r.columns));
    } catch (e) { setLoadError(String(e)); }
  }, []);

  const onUrl = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(urlInput);
      const text = await res.text();
      const r = parseSk6baCsv(text);
      setRows(r.rows); setColumns(r.columns);
      setSummary(summarize(r.rows, r.columns));
    } catch (e) { setLoadError(`Kunde inte hämta URL: ${e}`); }
  }, [urlInput]);

  const pipeline = useMemo(() => {
    if (!rows) return null;
    return runPipeline({ sk6baRows: rows, packChannels: selectedPackChannels, settings });
  }, [rows, settings, selectedPackChannels]);

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

  const doExport = () => {
    if (!pipeline) return;
    if (pipeline.duplicateStop) {
      alert("Export stoppad p.g.a. frekvensdubblett-policy. Ändra policyn eller åtgärda dubbletter först.");
      return;
    }
    download("chirp.csv", exportChirpCsv(pipeline.channels, settings.chirp));
  };

  const exportReport = () => {
    if (!pipeline) return;
    const lines = ["source_type,source_row,source_id,pack_id,name,warnings"];
    for (const c of pipeline.channels) {
      if (c.warnings.length) {
        lines.push(`${c.source_type},${c.source_row},${c.source_id},${c.pack_id},${c.generated_name_final},"${c.warnings.map((w) => w.message).join("; ")}"`);
      }
    }
    download("varningar.csv", lines.join("\n"));
  };

  const enabledPackCount = Object.values(settings.packs.selection).filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="font-mono text-xl font-semibold tracking-tight">sk6ba → chirp.csv</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Två oberoende källor — repeatrar från SK6BA/Marks och valfria kanalpaket — kombineras till en CHIRP-importerbar CSV. Allt sker lokalt i din webbläsare.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">

        {/* ───────────── REPEATERSEKTION ───────────── */}
        <Section
          title="Repeatrar (SK6BA / Marks-CSV)"
          subtitle="Repeatrar, länkar och hotspots från en CSV-export. Egna namngivnings- och filterregler."
        >
          {!rows && (
            <RepeaterLoader
              urlInput={urlInput} setUrlInput={setUrlInput}
              onFile={onFile} onUrl={onUrl} loadError={loadError}
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
          />
        </Section>

        {/* ───────────── EXPORT / SORTERING / CHIRP ───────────── */}
        {rows && (
          <Section
            title="Sortering & CHIRP-export"
            subtitle="Hur de kombinerade kanalerna ordnas i radions minne och vilka CHIRP-fält som används."
          >
            <ExportPanel
              settings={settings} setSettings={setSettings}
              hasPacks={enabledPackCount > 0}
            />
          </Section>
        )}

        {/* ───────────── PREVIEW ───────────── */}
        {pipeline && (
          <Section title="Förhandsgranska & exportera" right={
            <div className="flex gap-2">
              <button onClick={exportReport}
                className="rounded border border-border px-3 py-1.5 text-xs">Ladda ner varningar</button>
              <button onClick={doExport}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Exportera CHIRP-CSV ({pipeline.channels.length} kanaler)
              </button>
            </div>
          }>
            <div className="grid gap-2 md:grid-cols-5 text-sm mb-3">
              <Stat label="Input totalt" value={pipeline.totalInput} />
              <Stat label="SK6BA" value={pipeline.sk6baCount} />
              <Stat label="Kanalpaket" value={pipeline.packCount} />
              <Stat label="Filtrerade bort" value={pipeline.filteredOut} />
              <Stat label="Varn / Koll / Dupes / RX-only" value={`${stats?.warned ?? 0} / ${stats?.collided ?? 0} / ${stats?.dupes ?? 0} / ${stats?.rxOnly ?? 0}`} />
            </div>
            <PreviewTable channels={pipeline.channels} chirpMode={settings.chirp.mode} startLoc={settings.chirp.startLocation} />
          </Section>
        )}
      </main>

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground">
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

function RepeaterLoader({ urlInput, setUrlInput, onFile, onUrl, loadError }: {
  urlInput: string; setUrlInput: (s: string) => void;
  onFile: (f: File) => void; onUrl: () => void; loadError: string | null;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-background p-6 cursor-pointer hover:border-foreground/40">
          <span className="text-sm font-medium">Välj fil</span>
          <span className="text-xs text-muted-foreground">SK6BA / Marks repeater-CSV (.csv)</span>
          <input type="file" accept=".csv,text/csv" className="text-sm"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-6">
          <span className="text-sm font-medium">…eller hämta från URL</span>
          <input type="url" placeholder="https://..." value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="rounded border border-input bg-background px-2 py-1 text-sm" />
          <button onClick={onUrl} disabled={!urlInput}
            className="self-start rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Hämta
          </button>
          <p className="text-xs text-muted-foreground">CORS kan blockera vissa servrar — ladda upp filen istället om det fallerar.</p>
        </div>
      </div>
      {loadError && <p className="mt-3 text-sm text-destructive">{loadError}</p>}
    </>
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

function NamingEditor({ value, onChange, tokens, hint }: {
  value: NamingSettings; onChange: (n: NamingSettings) => void;
  tokens: string[]; hint?: string;
}) {
  const upd = (patch: Partial<NamingSettings>) => onChange({ ...value, ...patch });
  return (
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
        <NumberField label="Max längd kanalnamn" value={value.maxLength} onChange={(v) => upd({ maxLength: v })}
          hint="Många radior trunkerar vid 6–7 tecken." />
        <NumberField label="Max längd ort" value={value.cityMaxLength} onChange={(v) => upd({ cityMaxLength: v })} />
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
  );
}

/* ───────────── Channel packs panel ───────────── */

function ChannelPacksPanel({
  packs, settings, setSettings, selectedPackCount, selectedChannelCount,
}: {
  packs: MergedPack[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  selectedPackCount: number;
  selectedChannelCount: number;
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
          onChange={(patch) => updPack(pack.packId, patch)} />
      ))}
    </div>
  );
}

function PackRow({ pack, entry, onChange }: {
  pack: MergedPack;
  entry: PackSelectionEntry | undefined;
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
              hint={`Standard: \`{name_hint}\`, max 6 tecken — funkar för t.ex. "S20", "PMR1", "M16". Skriv egen mall om paketet kräver annat.`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── Export / CHIRP / sortering ───────────── */

function ExportPanel({ settings, setSettings, hasPacks }: {
  settings: Settings; setSettings: (s: Settings) => void; hasPacks: boolean;
}) {
  const updPacks = (patch: Partial<Settings["packs"]>) => setSettings({ ...settings, packs: { ...settings.packs, ...patch } });
  const updChirp = (patch: Partial<Settings["chirp"]>) => setSettings({ ...settings, chirp: { ...settings.chirp, ...patch } });
  const updSort = (patch: Partial<Settings["sort"]>) => setSettings({ ...settings, sort: { ...settings.sort, ...patch } });

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
        <SectionLabel>Sorteringsordning för repeatrar</SectionLabel>
        <Hint>Klicka för att lägga till/ta bort en sorteringsnyckel. Ordningen styr prioritet.</Hint>
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
        <SectionLabel>CHIRP-fält</SectionLabel>
        <div className="grid gap-3 md:grid-cols-4">
          <NumberField label="Startnummer (Location)" value={settings.chirp.startLocation}
            onChange={(v) => updChirp({ startLocation: v })}
            hint="Första minnesposition i radion. T.ex. 1 om du vill skriva från början, 100 om du vill lägga repeatrarna efter befintliga kanaler." />
          <Field label="Mode" hint="NFM = smal FM (12,5 kHz) — standard för amatörradio idag. FM = bred (25 kHz), äldre repeatrar.">
            <select value={settings.chirp.mode}
              onChange={(e) => updChirp({ mode: e.target.value as Settings["chirp"]["mode"] })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
              <option value="NFM">NFM (smal FM)</option>
              <option value="FM">FM (bred)</option>
            </select>
          </Field>
          <NumberField label="TStep (kHz)" step={0.5} value={settings.chirp.tStep}
            onChange={(v) => updChirp({ tStep: v })}
            hint="Frekvensraster vid manuell rattning på radion. 5 kHz funkar för 2m/70cm i Sverige. PMR/marin sätter eget per kanal." />
          <NumberField label="cToneFreq (Hz)" step={0.1} value={settings.chirp.cToneFreq}
            onChange={(v) => updChirp({ cToneFreq: v })}
            hint="Default-CTCSS som skrivs i cToneFreq-kolumnen när raden inte har en specifik ton. 88.5 Hz är CHIRP-standard." />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.chirp.skipLinks}
            onChange={(e) => updChirp({ skipLinks: e.target.checked })} />
          Hoppa över länkar och hotspots vid skanning i radion
          <span className="text-xs text-muted-foreground">(sätter Skip=S på Link/Hotspot — kanalen finns kvar men skannas inte)</span>
        </label>
      </div>
    </div>
  );
}

/* ───────────── Preview table ───────────── */

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

// Suppress unused-var lints for soon-to-be-used identifiers (columns kept for future inspector views).
void [columns => columns];
