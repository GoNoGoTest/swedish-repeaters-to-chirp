import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback, useEffect } from "react";
import { parseSk6baCsv, summarize, type Summary } from "@/lib/chirp/importers/sk6ba";
import { runPipeline } from "@/lib/chirp/pipeline";
import { exportChirpCsv } from "@/lib/chirp/exporters/chirp";
import { DEFAULT_SETTINGS } from "@/lib/chirp/defaults";
import { loadMergedPacks } from "@/lib/chirp/channel_packs/registry";
import { selectPackChannels, type ParsedPackChannel } from "@/lib/chirp/importers/channel_pack";
import type { RawRow, Settings, NormalizedChannel, PackPlacement, FreqDupePolicy, RxOnlyPolicy } from "@/lib/chirp/models";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SK6BA → CHIRP-CSV" },
      { name: "description", content: "Bygg en CHIRP-CSV från Marks Amatörradioklubbs repeaterexport, valfritt kombinerat med svenska amatörradio-kanalpaket för 2m och 70cm." },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "sk6ba-chirp-settings-v2";

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
    return { ...DEFAULT_SETTINGS, ...parsed, packs: { ...DEFAULT_SETTINGS.packs, ...(parsed.packs ?? {}) } };
  } catch { return DEFAULT_SETTINGS; }
}

function Index() {
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadStoredSettings());
  const [advanced, setAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const packs = useMemo(() => loadMergedPacks(), []);

  // Currently selected pack rows derived from settings.packs.selection
  const selectedPackChannels = useMemo<NormalizedChannel[]>(() => {
    if (settings.packs.placement === "off") return [];
    const out: ParsedPackChannel[] = [];
    for (const pack of packs) {
      const sel = settings.packs.selection[pack.packId];
      if (!sel) continue;
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
    } catch (e) {
      setLoadError(String(e));
    }
  }, []);

  const onUrl = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(urlInput);
      const text = await res.text();
      const r = parseSk6baCsv(text);
      setRows(r.rows); setColumns(r.columns);
      setSummary(summarize(r.rows, r.columns));
    } catch (e) {
      setLoadError(`Kunde inte hämta URL: ${e}`);
    }
  }, [urlInput]);

  const pipeline = useMemo(() => {
    if (!rows) return null;
    return runPipeline({ sk6baRows: rows, packChannels: selectedPackChannels, settings });
  }, [rows, settings, selectedPackChannels]);

  const stats = useMemo(() => {
    if (!pipeline) return null;
    let warned = 0, collided = 0, rxOnly = 0, dupes = 0, inferred = 0;
    for (const c of pipeline.channels) {
      if (c.warnings.length) warned++;
      if (c.collided) collided++;
      if (c.rx_only) rxOnly++;
      if (c.warnings.some((w) => w.code === "freq_duplicate")) dupes++;
      if (c.inferred_from_range) inferred++;
    }
    return { warned, collided, rxOnly, dupes, inferred };
  }, [pipeline]);

  const doExport = () => {
    if (!pipeline) return;
    if (pipeline.duplicateStop) {
      alert("Export stoppad p.g.a. frekvensdubblett-policy. Ändra policyn eller åtgärda dubbletter först.");
      return;
    }
    const csv = exportChirpCsv(pipeline.channels, settings.chirp);
    download("chirp.csv", csv);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="font-mono text-xl font-semibold tracking-tight">sk6ba → chirp.csv</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Konvertera Marks Amatörradioklubbs repeaterexport till en CHIRP-importerbar CSV — och lägg valfritt till svenska amatörradio-kanalpaket för 2m och 70cm. All bearbetning sker lokalt i din webbläsare.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {!rows && (
          <Section title="1. Ladda in CSV">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-card p-6 cursor-pointer hover:border-foreground/40">
                <span className="text-sm font-medium">Välj fil</span>
                <span className="text-xs text-muted-foreground">SK6BA / Marks repeater-CSV (.csv)</span>
                <input type="file" accept=".csv,text/csv" className="text-sm"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-6">
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
          </Section>
        )}

        {summary && rows && (
          <Section title="2. Datainspektion" right={
            <button onClick={() => { setRows(null); setSummary(null); }}
              className="text-xs text-muted-foreground underline">Byt fil</button>
          }>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
              <Stat label="Rader" value={summary.totalRows} />
              <Stat label="Kolumner" value={summary.columns.length} />
              <Stat label="Saknad output" value={summary.missingOutput} />
              <Stat label="Saknade koord." value={summary.missingCoords} />
              <Stat label="Oklar tx_shift" value={summary.unclearShift} />
              <Stat label="Saknar CTCSS" value={summary.missingTone} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(["type","status","mode","band","district","network"] as const).map((f) => (
                <UniqueList key={f} title={f} counts={summary.uniqueCounts[f]} />
              ))}
            </div>
          </Section>
        )}

        {rows && (
          <Section title="3. Inställningar" right={
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
              Avancerat läge
            </label>
          }>
            <SettingsPanel summary={summary!} settings={settings} setSettings={setSettings} advanced={advanced} />
          </Section>
        )}

        {rows && (
          <Section title="4. Kanalpaket">
            <ChannelPacksPanel
              packs={packs}
              settings={settings}
              setSettings={setSettings}
              selectedCount={selectedPackChannels.length}
            />
          </Section>
        )}

        {pipeline && (
          <Section title="5. Preview" right={
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
              <Stat label="Input" value={pipeline.totalInput} />
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

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border bg-background px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}

function UniqueList({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <ul className="space-y-0.5 text-xs font-mono">
        {entries.map(([k, v]) => (
          <li key={k} className="flex justify-between"><span className="truncate">{k}</span><span className="text-muted-foreground ml-2">{v}</span></li>
        ))}
      </ul>
    </div>
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

function SettingsPanel({ summary, settings, setSettings, advanced }: {
  summary: Summary; settings: Settings; setSettings: (s: Settings) => void; advanced: boolean;
}) {
  const allStatuses = Object.keys(summary.uniqueCounts.status);
  const allTypes = Object.keys(summary.uniqueCounts.type);
  const allBands = Object.keys(summary.uniqueCounts.band);
  const allDistricts = Object.keys(summary.uniqueCounts.district).filter((d) => /^\d+$/.test(d));

  const upd = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  const tokens = ["{type}", "{network}", "{band}", "{district}", "{city}", "{channel}", "{call}", "{service}", "{category}", "{label}", "{name_hint}"];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelect label="Status" options={allStatuses} value={settings.filter.statuses}
          onChange={(v) => upd("filter", { ...settings.filter, statuses: v })} />
        <MultiSelect label="Type" options={allTypes} value={settings.filter.types}
          onChange={(v) => upd("filter", { ...settings.filter, types: v })} />
        <MultiSelect label="Band" options={allBands} value={settings.filter.bands}
          onChange={(v) => upd("filter", { ...settings.filter, bands: v })} />
        <MultiSelect label="Distrikt (tomt = alla svenska)" options={allDistricts} value={settings.filter.districts}
          onChange={(v) => upd("filter", { ...settings.filter, districts: v })} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Mode-strategi</div>
          <select value={settings.filter.modeStrategy}
            onChange={(e) => upd("filter", { ...settings.filter, modeStrategy: e.target.value as any })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
            <option value="contains_fm">Mode innehåller FM</option>
            <option value="exact_fm">Exakt FM</option>
            <option value="all">Alla rader</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={settings.filter.includeUnknownDistricts}
            onChange={(e) => upd("filter", { ...settings.filter, includeUnknownDistricts: e.target.checked })} />
          Inkludera utländska/okända distrikt
        </label>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={settings.chirp.skipLinks}
            onChange={(e) => upd("chirp", { ...settings.chirp, skipLinks: e.target.checked })} />
          Markera Link som Skip
        </label>
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Namngivning</div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Komponenter (klicka för att lägga till/ta bort, i tur och ordning)</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {settings.naming.components.map((t, i) => (
                <button key={`${t}-${i}`} type="button"
                  onClick={() => upd("naming", { ...settings.naming, components: settings.naming.components.filter((_, j) => j !== i) })}
                  className="rounded border border-primary bg-primary px-2 py-0.5 text-xs font-mono text-primary-foreground">
                  {t} ×
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {tokens.map((t) => (
                <button key={t} type="button"
                  onClick={() => upd("naming", { ...settings.naming, components: [...settings.naming.components, t] })}
                  className="rounded border border-border px-2 py-0.5 text-xs font-mono">
                  + {t}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tomma komponenter droppas automatiskt (inga dubbla separatorer). Kanalpaketsrader utan city/call faller tillbaka på <code>name_hint</code>/<code>channel</code>/<code>label</code>.
            </p>
          </div>
          <div className="space-y-2">
            <NumberField label="Max längd kanalnamn" value={settings.naming.maxLength}
              onChange={(v) => upd("naming", { ...settings.naming, maxLength: v })} />
            <NumberField label="Max längd ort" value={settings.naming.cityMaxLength}
              onChange={(v) => upd("naming", { ...settings.naming, cityMaxLength: v })} />
            <div>
              <div className="text-xs text-muted-foreground mb-1">Separator</div>
              <input value={settings.naming.separator}
                onChange={(e) => upd("naming", { ...settings.naming, separator: e.target.value })}
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono" placeholder="(inget)" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.naming.transliterate}
              onChange={(e) => upd("naming", { ...settings.naming, transliterate: e.target.checked })} />
            Translitterera svenska tecken
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.naming.uppercase}
              onChange={(e) => upd("naming", { ...settings.naming, uppercase: e.target.checked })} />
            Versaler
          </label>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Kollisionspolicy</div>
            <select value={settings.naming.collisionPolicy}
              onChange={(e) => upd("naming", { ...settings.naming, collisionPolicy: e.target.value as any })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
              <option value="numeric_suffix">Numeriskt suffix</option>
              <option value="last_char_suffix">Bokstavssuffix (A,B,C)</option>
              <option value="stop">Stoppa export</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">CHIRP & sortering</div>
        <div className="grid gap-3 md:grid-cols-4">
          <NumberField label="Startnummer (Location)" value={settings.chirp.startLocation}
            onChange={(v) => upd("chirp", { ...settings.chirp, startLocation: v })} />
          <div>
            <div className="text-xs text-muted-foreground mb-1">Mode</div>
            <select value={settings.chirp.mode}
              onChange={(e) => upd("chirp", { ...settings.chirp, mode: e.target.value as any })}
              className="w-full rounded border border-input bg-background px-2 py-1 text-sm">
              <option value="NFM">NFM (smal FM)</option>
              <option value="FM">FM</option>
            </select>
          </div>
          <NumberField label="TStep (kHz)" step={0.5} value={settings.chirp.tStep}
            onChange={(v) => upd("chirp", { ...settings.chirp, tStep: v })} />
          <NumberField label="cToneFreq" step={0.1} value={settings.chirp.cToneFreq}
            onChange={(v) => upd("chirp", { ...settings.chirp, cToneFreq: v })} />
        </div>

        {advanced && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-1">Sorteringsordning</div>
            <div className="flex flex-wrap gap-1">
              {(["district","geohash","type","city","frequency"] as const).map((k) => {
                const idx = settings.sort.keys.indexOf(k);
                const on = idx !== -1;
                return (
                  <button key={k} type="button"
                    onClick={() => {
                      const keys = on ? settings.sort.keys.filter((x) => x !== k) : [...settings.sort.keys, k];
                      upd("sort", { ...settings.sort, keys });
                    }}
                    className={`rounded border px-2 py-0.5 text-xs font-mono ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
                    {on ? `${idx + 1}. ${k}` : k}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono" />
    </div>
  );
}

function ChannelPacksPanel({
  packs, settings, setSettings, selectedCount,
}: {
  packs: ReturnType<typeof loadMergedPacks>;
  settings: Settings;
  setSettings: (s: Settings) => void;
  selectedCount: number;
}) {
  const upd = (patch: Partial<Settings["packs"]>) => setSettings({ ...settings, packs: { ...settings.packs, ...patch } });
  const updSel = (packId: string, patch: Partial<Settings["packs"]["selection"][string]>) => {
    const cur = settings.packs.selection[packId] ?? { bands: [], categories: [], tags: [], useEnabledDefault: false };
    upd({ selection: { ...settings.packs.selection, [packId]: { ...cur, ...patch } } });
  };

  const placement = settings.packs.placement;
  const enabled = placement !== "off";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-xs text-muted-foreground mb-1">Lägg till kanalpaket utöver repeaterimporten?</div>
          <div className="flex flex-wrap gap-1">
            {([
              ["off","Nej"],
              ["prepend","Ja — i början"],
              ["append","Ja — i slutet"],
              ["merge_sort","Ja — samma sortering"],
            ] as Array<[PackPlacement,string]>).map(([k,label]) => (
              <button key={k} type="button"
                onClick={() => upd({ placement: k })}
                className={`rounded border px-2 py-1 text-xs ${placement === k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Frekvensdubblett-policy</div>
          <select value={settings.packs.freqDupePolicy} disabled={!enabled}
            onChange={(e) => upd({ freqDupePolicy: e.target.value as FreqDupePolicy })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm disabled:opacity-50">
            <option value="keep_both">Behåll båda</option>
            <option value="drop_pack">Hoppa över pack-rad</option>
            <option value="drop_sk6ba">Hoppa över SK6BA-rad</option>
            <option value="stop">Stoppa export</option>
          </select>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">RX-only-policy (framtida paket)</div>
          <select value={settings.packs.rxOnlyPolicy} disabled={!enabled}
            onChange={(e) => upd({ rxOnlyPolicy: e.target.value as RxOnlyPolicy })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm disabled:opacity-50">
            <option value="mark">Varna + markera RX-ONLY i Comment</option>
            <option value="duplex_off">Exportera som Duplex=off</option>
            <option value="skip">Hoppa över</option>
            <option value="stop">Stoppa export</option>
          </select>
        </div>
      </div>

      {!enabled && (
        <p className="text-xs text-muted-foreground">
          Default är <em>Nej</em>. Kanalpaket är fasta kanaler — simplex, APRS, anropskanaler, aktivitetscentra m.m. — som inte är repeatrar. Aktivera ovan för att kombinera dem med SK6BA-importen.
        </p>
      )}

      {enabled && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {selectedCount} kanaler valda från {packs.length} paket.
          </div>
          {packs.map((pack) => {
            const sel = settings.packs.selection[pack.packId] ?? { bands: [], categories: [], tags: [], useEnabledDefault: false };
            const bands = Array.from(new Set(pack.channels.map((c) => c.band).filter(Boolean))).sort();
            const categories = Array.from(new Set(pack.channels.map((c) => c.category).filter(Boolean))).sort();
            const tags = Array.from(new Set(pack.channels.flatMap((c) => c.tags))).sort();
            const services = Array.from(new Set(pack.channels.map((c) => c.service).filter(Boolean))).join(", ");
            const enabledDefaultCount = pack.channels.filter((c) => c.enabled_default).length;

            return (
              <div key={pack.packId} className="rounded border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-mono text-sm font-semibold">{pack.packId}</div>
                    <div className="text-xs text-muted-foreground">
                      {pack.channels.length} rader · service: {services || "–"} · {pack.fileNames.join(", ")}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => updSel(pack.packId, { useEnabledDefault: true, bands: [], categories: [], tags: [], manualSourceIds: [] })}
                      className="rounded border border-border px-2 py-1 text-xs">
                      Använd default ({enabledDefaultCount})
                    </button>
                    <button type="button"
                      onClick={() => updSel(pack.packId, { useEnabledDefault: false, bands: [], categories: [], tags: [], manualSourceIds: [] })}
                      className="rounded border border-border px-2 py-1 text-xs">
                      Avmarkera
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <MultiSelect label="Band" options={bands} value={sel.bands}
                    onChange={(v) => updSel(pack.packId, { bands: v })} />
                  <MultiSelect label="Kategori" options={categories} value={sel.categories}
                    onChange={(v) => updSel(pack.packId, { categories: v })} />
                  <MultiSelect label="Tag" options={tags} value={sel.tags}
                    onChange={(v) => updSel(pack.packId, { tags: v })} />
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={sel.useEnabledDefault}
                    onChange={(e) => updSel(pack.packId, { useEnabledDefault: e.target.checked })} />
                  Bara rader med <code>enabled_default=true</code> ({enabledDefaultCount} rader). Tomt band/kategori/tag = alla.
                </label>
              </div>
            );
          })}
        </div>
      )}
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
