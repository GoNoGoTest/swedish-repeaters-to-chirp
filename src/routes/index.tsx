import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChirpSettings, NormalizedChannel, Warning } from "@/lib/codeplug/models";
import { requireTarget, resolveTargetSettings } from "@/lib/codeplug/targets";
import { loadSk6baCsv, type Sk6baLoadState } from "@/lib/codeplug/importers/sk6ba";
import { useCodeplugSettings } from "@/hooks/useCodeplugSettings";
import { useSavedSk6baExports } from "@/hooks/useSavedSk6baExports";
import { useSelectedPackChannels } from "@/hooks/useSelectedPackChannels";
import { useCodeplugPipeline } from "@/hooks/useCodeplugPipeline";
import { useCodeplugDownload } from "@/hooks/useCodeplugDownload";
import { Section, Stat } from "@/components/codeplug/common";
import { RepeaterLoader } from "@/components/codeplug/RepeaterLoader";
import { TargetPickerPanel } from "@/components/codeplug/TargetPickerPanel";
import { RepeaterFilterPanel } from "@/components/codeplug/RepeaterFilterPanel";
import { ChannelPacksPanel } from "@/components/codeplug/ChannelPacksPanel";
import { NamingEditor } from "@/components/codeplug/NamingEditor";
import { ExportPanel, RxOnlyExportNote } from "@/components/codeplug/ExportPanel";
import { PreviewTable, channelKey } from "@/components/codeplug/PreviewTable";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SK6BA → CHIRP-CSV" },
      { name: "description", content: "Bygg en CHIRP-CSV från Marks Amatörradioklubbs repeaterexport och kombinera fritt med svenska amatörradio- och RX-only-kanalpaket." },
    ],
  }),
  component: Index,
});

const REPEATER_TOKENS = ["{type}", "{network}", "{band}", "{district}", "{region}", "{country}", "{city}", "{channel}", "{call}", "{mode}"];

function Index() {
  const { settings, setSettings } = useCodeplugSettings();
  const saved = useSavedSk6baExports();

  const [loadState, setLoadState] = useState<Sk6baLoadState>({ status: "empty" });
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  type StatFilter = "warned" | "collided" | "dupes" | "rxOnly";
  const [statFilter, setStatFilter] = useState<StatFilter | null>(null);
  const toggleStatFilter = useCallback((f: StatFilter) => {
    setStatFilter((prev) => (prev === f ? null : f));
  }, []);

  const toggleExclude = useCallback((key: string) => {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const resetExcluded = useCallback(() => setExcludedKeys(new Set()), []);

  // Active export target — discriminated union (AnyExportTarget) keyed on `id`.
  // Narrow with `target.id === "chirp-generic" | "vgc-n76"` to access settings
  // safely; no `as` casts needed at call sites.
  const target = useMemo(
    () => requireTarget(settings.export.targetId),
    [settings.export.targetId],
  );
  const storedPatch = settings.export.perTarget[settings.export.targetId] as
    | Record<string, unknown>
    | undefined;
  // Per-target resolved settings (defaults merged with user patch). Each
  // branch narrows `target` to its concrete variant so the settings type is
  // exact — no `as unknown as XSettings` cast.
  const chirpSettings: ChirpSettings = target.id === "chirp-generic"
    ? resolveTargetSettings(target, storedPatch)
    : { startLocation: 1, mode: "NFM", tStep: 5.0, skipLinks: false, maxLength: 6 };
  // Persisted patch is opaque outside this file; pass through to ExportPanel,
  // which narrows again on `target.id` before handing to per-target sub-panels.
  const targetSettings: Record<string, unknown> = (storedPatch ?? {}) as Record<string, unknown>;
  const maxNameLength = (() => {
    switch (target.id) {
      case "chirp-generic":
        return target.resolveMaxNameLength?.(resolveTargetSettings(target, storedPatch)) ?? target.limits.maxNameLength;
      case "vgc-n76":
        return target.resolveMaxNameLength?.(resolveTargetSettings(target, storedPatch)) ?? target.limits.maxNameLength;
      case "nicsure-rt880":
        return target.resolveMaxNameLength?.(resolveTargetSettings(target, storedPatch)) ?? target.limits.maxNameLength;
      case "rt-systems-yaesu-generic":
        return target.resolveMaxNameLength?.(resolveTargetSettings(target, storedPatch)) ?? target.limits.maxNameLength;
    }
  })();

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
  }, [setSettings]);

  const { packs, selectedChannels, enabledPackCount } = useSelectedPackChannels(settings);

  const rows = loadState.status === "loaded" ? loadState.rows : null;
  const summary = loadState.status === "loaded" ? loadState.summary : null;

  const pipeline = useCodeplugPipeline({ rows, packChannels: selectedChannels, settings, maxNameLength });

  const exportChannels = useMemo(() => {
    if (!pipeline) return [] as NormalizedChannel[];
    if (excludedKeys.size === 0) return pipeline.channels;
    return pipeline.channels.filter((c) => !excludedKeys.has(channelKey(c)));
  }, [pipeline, excludedKeys]);

  const stats = useMemo(() => {
    if (!pipeline) return null;
    let warned = 0, collided = 0, rxOnly = 0, dupes = 0;
    for (const c of exportChannels) {
      if (c.warnings.some((w) => w.code !== "name_collision")) warned++;
      if (c.collided) collided++;
      if (c.rx_only) rxOnly++;
      if (c.warnings.some((w) => w.code === "freq_duplicate")) dupes++;
    }
    return { warned, collided, rxOnly, dupes };
  }, [pipeline, exportChannels]);

  const previewChannels = useMemo(() => {
    if (!pipeline) return [] as NormalizedChannel[];
    if (!statFilter) return pipeline.channels;
    return pipeline.channels.filter((c) => {
      switch (statFilter) {
        case "warned": return c.warnings.some((w) => w.code !== "name_collision");
        case "collided": return c.collided;
        case "dupes": return c.warnings.some((w) => w.code === "freq_duplicate");
        case "rxOnly": return c.rx_only;
      }
    });
  }, [pipeline, statFilter]);


  const statFilterLabel: Record<StatFilter, string> = {
    warned: "Varningar",
    collided: "Namnkollisioner",
    dupes: "Frekvensdubbletter",
    rxOnly: "RX-only",
  };

  const { exportFiles, exportWarnings } = useCodeplugDownload({ settings, exportChannels });

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    const state = loadSk6baCsv(text);
    setLoadState(state);
    if (state.status === "loaded") {
      saved.save({ filename: file.name, content: text, rowCount: state.rowCount });
    }
  }, [saved]);

  const onPickSaved = useCallback((id: string) => {
    const entry = saved.find(id);
    if (!entry) return;
    setLoadState(loadSk6baCsv(entry.content));
  }, [saved]);

  const split = settings.export.split;
  const willSplit = split.mode !== "single" && !!target.exportMany;

  const doExport = async () => {
    if (!pipeline || pipeline.duplicateStop) return;
    await exportFiles();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-6 py-5">
          <h1 className="font-mono text-xl font-semibold tracking-tight">sk6ba → codeplug</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Två oberoende källor — repeatrar från SK6BA/Marks och valfria kanalpaket — kombineras till en CSV för CHIRP eller direkt till radions egen app. Allt sker lokalt i din webbläsare.
          </p>
          <nav className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <a href="https://sk6ba.se/vhf/repeater/karta/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
              Hämta CSV från SK6BA:s repeaterkarta
            </a>
            <span aria-hidden="true">·</span>
            <a href="https://github.com/GoNoGoTest/swedish-repeaters-to-codeplug/" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
              GitHub
            </a>
            <span aria-hidden="true">·</span>
            <a href="https://github.com/GoNoGoTest/swedish-repeaters-to-codeplug/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">
              MIT-licens
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className={pipeline ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}>
          <div className="space-y-6 min-w-0">

            <Section
              title="Exportformat"
              subtitle="Välj först — formatet styr namnlängd, varningar och vilka splittnings­alternativ som är meningsfulla."
            >
              <TargetPickerPanel settings={settings} setSettings={setSettings} />
            </Section>

            <Section
              title="Repeatrar (SK6BA / Marks-CSV)"
              subtitle="Repeatrar, länkar och hotspots från en CSV-export. Egna namngivnings- och filterregler."
            >
              {loadState.status !== "loaded" && (
                <RepeaterLoader
                  onFile={onFile}
                  loadState={loadState}
                  savedExports={saved.items}
                  onPickSaved={onPickSaved}
                  onDeleteSaved={saved.remove}
                  onClearSaved={saved.clear}
                />
              )}

              {loadState.status === "loaded" && summary && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {summary.totalRows} rader · {summary.columns.length} kolumner
                    </div>
                    <button onClick={() => setLoadState({ status: "empty" })}
                      className="text-xs text-muted-foreground underline">Byt fil</button>
                  </div>

                  {(() => {
                    const totalRows = summary.totalRows;
                    const inExport = exportChannels.length;
                    const droppedOut = Math.max(0, totalRows - inExport);
                    const outOfScope = pipeline?.outOfScope ?? 0;
                    const missingRx = Math.max(
                      0,
                      totalRows - (pipeline?.withRx ?? totalRows) - outOfScope,
                    );
                    const droppedByDedupe = pipeline?.droppedByDedupe ?? 0;
                    const manuallyExcluded = excludedKeys.size;
                    // Allt övrigt (band/status/distrikt/läge-filter, namnlöshet, m.m.)
                    const droppedByFilter = Math.max(
                      0,
                      droppedOut - missingRx - droppedByDedupe - manuallyExcluded - outOfScope,
                    );
                    const lines: string[] = [
                      `${droppedOut} av ${totalRows} rader hamnar inte i exporten`,
                      "",
                    ];
                    if (outOfScope) lines.push(`• uW QTH (utanför scope): ${outOfScope}`);
                    if (missingRx) lines.push(`• Saknar RX-frekvens: ${missingRx}`);
                    if (droppedByFilter) lines.push(`• Bortfiltrerade av filter: ${droppedByFilter}`);
                    if (droppedByDedupe) lines.push(`• Frekvensdubbletter: ${droppedByDedupe}`);
                    if (manuallyExcluded) lines.push(`• Manuellt exkluderade: ${manuallyExcluded}`);
                    const tooltip = droppedOut > 0 ? lines.join("\n") : undefined;
                    return (
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <Stat label="Rader i import" value={totalRows} />
                        <Stat label="Kanaler i export" value={inExport} />
                        <Stat label="Bortfiltrerade" value={droppedOut} tooltip={tooltip} />
                      </div>
                    );
                  })()}

                  <RepeaterFilterPanel summary={summary} settings={settings} setSettings={setSettings} />

                  <div className="border-t border-border pt-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Namngivning av repeatrar</div>
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

            <Section
              title="Kanalpaket"
              subtitle="Fasta kanaler från CSV-paket i /channelpacks (amatör simplex, marin VHF, PMR446 m.fl.). Varje paket har egna inställningar och egen namngivning."
            >
              <ChannelPacksPanel
                packs={packs}
                settings={settings}
                setSettings={setSettings}
                selectedPackCount={enabledPackCount}
                selectedChannelCount={selectedChannels.length}
                maxNameLength={maxNameLength}
              />
            </Section>

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
                  channels={exportChannels}
                />

              </Section>
            )}
          </div>

          {pipeline && (
            <div className="min-w-0">
              <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
                <Section title="Förhandsgranska & exportera" right={
                  <div className="flex gap-2">
                    <button onClick={exportWarnings}
                      className="rounded border border-border px-3 py-1.5 text-xs">Varningar</button>
                    <button onClick={doExport}
                      disabled={pipeline.duplicateStop}
                      className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                      Exportera {target.label} ({exportChannels.length}){willSplit ? " [ZIP]" : ""}
                    </button>
                  </div>
                }>
                  {pipeline.duplicateStop && (
                    <div role="alert" className="mb-3 rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      Export stoppad — frekvensdubbletter enligt policy. Ändra policy eller åtgärda dubbletter.
                    </div>
                  )}
                  <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 text-sm mb-3">
                    <Stat label="Från SK6BA" value={pipeline.sk6baCount} />
                    <Stat label="Från kanalpaket" value={pipeline.packCount} />
                    <Stat
                      label="Varningar"
                      value={stats?.warned ?? 0}
                      tooltip="Exportkanaler som har minst en varning utöver namnkollision (t.ex. RX-only-policy, otydlig access, namnsaknad). Namnkollisioner räknas separat. Klicka för att filtrera previewn — exporten påverkas inte."
                      onClick={() => toggleStatFilter("warned")}
                      active={statFilter === "warned"}
                    />
                    <Stat
                      label="Namnkollisioner"
                      value={stats?.collided ?? 0}
                      tooltip="Kanaler där det genererade namnet krockar med ett annat. Klicka för att filtrera previewn — exporten påverkas inte."
                      onClick={() => toggleStatFilter("collided")}
                      active={statFilter === "collided"}
                    />
                    <Stat
                      label="Frekvensdubbletter"
                      value={stats?.dupes ?? 0}
                      tooltip="Kanaler som delar RX-frekvens med en annan kanal (oftast pack-vs-SK6BA). Klicka för att filtrera previewn — exporten påverkas inte."
                      onClick={() => toggleStatFilter("dupes")}
                      active={statFilter === "dupes"}
                    />
                    <Stat
                      label="RX-only"
                      value={stats?.rxOnly ?? 0}
                      tooltip="Kanaler från kanalpaket som är mottagningsbara men inte sändningsbara. Klicka för att filtrera previewn — exporten påverkas inte."
                      onClick={() => toggleStatFilter("rxOnly")}
                      active={statFilter === "rxOnly"}
                    />
                  </div>
                  {excludedKeys.size > 0 && (
                    <div className="mb-3 flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-2 text-xs">
                      <span>Exkluderade rader: <strong>{excludedKeys.size}</strong> (visas i previewen men tas inte med i exporten)</span>
                      <button onClick={resetExcluded} className="rounded border border-border px-2 py-1">Återställ</button>
                    </div>
                  )}
                  {(() => {
                    // Narrow on `target.id` so validate() gets its exact settings type.
                    let tw: Warning[] | undefined;
                    switch (target.id) {
                      case "chirp-generic":
                        tw = target.validate?.(exportChannels, resolveTargetSettings(target, storedPatch));
                        break;
                      case "vgc-n76":
                        tw = target.validate?.(exportChannels, resolveTargetSettings(target, storedPatch));
                        break;
                      case "nicsure-rt880":
                        tw = target.validate?.(exportChannels, resolveTargetSettings(target, storedPatch));
                        break;
                    }
                    if (!tw || tw.length === 0) return null;
                    return (
                      <ul className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                        {tw.map((w, i) => <li key={i}>⚠ {w.message}</li>)}
                      </ul>
                    );
                  })()}
                  {statFilter && (
                    <div className="mb-3 flex items-center justify-between rounded border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                      <span>
                        Previewen är filtrerad: <strong>{statFilterLabel[statFilter]}</strong>
                        {" "}({previewChannels.length} rader) · exporten innehåller fortfarande alla {exportChannels.length} rader.
                      </span>
                      <button onClick={() => setStatFilter(null)} className="rounded border border-border px-2 py-1">Visa alla</button>
                    </div>
                  )}
                  <PreviewTable
                    channels={previewChannels}
                    excludedKeys={excludedKeys}
                    onToggleExclude={toggleExclude}
                    chirpMode={target.id === "chirp-generic" ? chirpSettings.mode : "NFM"}
                    startLoc={target.id === "chirp-generic" ? chirpSettings.startLocation : 1}
                    exportCount={exportChannels.length}
                  />
                </Section>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-[1600px] px-6 py-4 text-xs text-muted-foreground">
          Verktyget skapar codeplug-CSV för CHIRP eller direktimport i radions egen app (t.ex. VGC N76). Digitala moder stöds inte i v1.
        </div>
      </footer>
    </div>
  );
}
