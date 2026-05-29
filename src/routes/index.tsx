import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { parseSk6baCsv, summarize, type Summary } from "@/lib/chirp/importers/sk6ba";
import { runPipeline } from "@/lib/chirp/pipeline";
import { exportChirpCsv } from "@/lib/chirp/exporters/chirp";
import { DEFAULT_SETTINGS } from "@/lib/chirp/defaults";
import type { RawRow, Settings } from "@/lib/chirp/models";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SK6BA → CHIRP-CSV" },
      { name: "description", content: "Bygg en CHIRP-CSV från Marks Amatörradioklubbs repeaterexport." },
    ],
  }),
  component: Index,
});

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Index() {
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [advanced, setAdvanced] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

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
    return runPipeline(rows, settings);
  }, [rows, settings]);

  const stats = useMemo(() => {
    if (!pipeline) return null;
    let warned = 0, collided = 0;
    for (const c of pipeline.channels) {
      if (c.warnings.length) warned++;
      if (c.collided) collided++;
    }
    return { warned, collided };
  }, [pipeline]);

  const doExport = () => {
    if (!pipeline) return;
    const csv = exportChirpCsv(pipeline.channels, settings.chirp);
    download("chirp.csv", csv);
  };

  const exportReport = () => {
    if (!pipeline) return;
    const lines = ["source_row,name,warnings"];
    for (const c of pipeline.channels) {
      if (c.warnings.length) {
        lines.push(`${c.source_row},${c.generated_name_final},"${c.warnings.map((w) => w.message).join("; ")}"`);
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
            Konvertera Marks Amatörradioklubbs repeaterexport till en CHIRP-importerbar CSV. All bearbetning sker lokalt i din webbläsare.
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

        {pipeline && (
          <Section title="4. Preview" right={
            <div className="flex gap-2">
              <button onClick={exportReport}
                className="rounded border border-border px-3 py-1.5 text-xs">Ladda ner varningar</button>
              <button onClick={doExport}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Exportera CHIRP-CSV ({pipeline.channels.length} kanaler)
              </button>
            </div>
          }>
            <div className="grid gap-2 md:grid-cols-4 text-sm mb-3">
              <Stat label="Input" value={pipeline.totalInput} />
              <Stat label="Exporteras" value={pipeline.channels.length} />
              <Stat label="Filtrerade bort" value={pipeline.filteredOut} />
              <Stat label="Varningar / kollisioner" value={`${stats?.warned ?? 0} / ${stats?.collided ?? 0}`} />
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

  const tokens = ["{type}", "{network}", "{band}", "{district}", "{city}", "{channel}", "{call}"];

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

function PreviewTable({ channels, chirpMode, startLoc }: { channels: any[]; chirpMode: string; startLoc: number }) {
  const shown = channels.slice(0, 200);
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="min-w-full text-xs font-mono">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {["#","Loc","Namn (full → final)","Freq","Dpx","Off","Tone","Mode","Type/Net","City","Call","Comment","⚠"].map((h) => (
              <th key={h} className="px-2 py-1 text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((c, i) => (
            <tr key={c.source_row} className={`border-t border-border ${c.warnings.length ? "bg-destructive/5" : ""}`}>
              <td className="px-2 py-1 text-muted-foreground">{c.source_row}</td>
              <td className="px-2 py-1">{startLoc + i}</td>
              <td className="px-2 py-1">
                <div className="text-muted-foreground">{c.generated_name_full}</div>
                <div className={c.collided ? "text-amber-500" : ""}>{c.generated_name_final}</div>
              </td>
              <td className="px-2 py-1">{c.rx_frequency?.toFixed(4)}</td>
              <td className="px-2 py-1">{c.duplex || "—"}</td>
              <td className="px-2 py-1">{c.offset.toFixed(3)}</td>
              <td className="px-2 py-1">{c.ctcss_tx ?? (c.uses_1750 ? "1750" : "—")}</td>
              <td className="px-2 py-1">{chirpMode}</td>
              <td className="px-2 py-1">{c.type}{c.network ? `/${c.network}` : ""}</td>
              <td className="px-2 py-1 truncate max-w-[10rem]">{c.city}</td>
              <td className="px-2 py-1">{c.call}</td>
              <td className="px-2 py-1 truncate max-w-[14rem] text-muted-foreground">{c.comment}</td>
              <td className="px-2 py-1">{c.warnings.length ? <span title={c.warnings.map((w: any) => w.message).join("; ")} className="text-amber-500">!{c.warnings.length}</span> : ""}</td>
            </tr>
          ))}
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
