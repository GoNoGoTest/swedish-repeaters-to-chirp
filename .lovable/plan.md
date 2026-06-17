## Mål

Två låg-risk-förbättringar utan beteendeförändring:

1. Bryt isär `src/routes/index.tsx` (1447 rader) i komponenter och hooks.
2. Gör SK6BA-importervalidering tydlig — stoppa pipelinen och visa vilka kolumner som saknas.

Kärnlogik i `src/lib/codeplug` rörs inte. CHIRP/VGC/split-export rörs inte. Inga nya tester för redan täckta områden. DMR och metadata-städ skjuts till separata turer.

## 1. Route-split

### Nya hooks (`src/hooks/`)

- `useCodeplugSettings.ts` — håller hela `Settings`-objektet + persist till localStorage. Returnerar `{ settings, setSettings, patch(partial), reset }`.
- `useSavedSk6baExports.ts` — wrappar `saved-exports.ts` (lista, spara, ladda, ta bort senaste SK6BA-CSV).
- `useSelectedPackChannels.ts` — läser `channel_packs/registry`, plockar valda kanaler baserat på `settings.packs.selection`. Returnerar `{ availablePacks, selectedChannels }`.
- `useCodeplugPipeline.ts` — `useMemo` runt `runPipeline(...)`, tar `rawRows`, `selectedPackChannels`, `settings`, `maxNameLength`. Returnerar `PipelineResult`.
- `useCodeplugDownload.ts` — bygger filer via target-registry + `splitExport`, triggar nedladdning (Blob + `URL.createObjectURL`). Returnerar `{ download(), isReady, warnings }`.

### Nya komponenter (`src/components/codeplug/`)

- `common.tsx` — `Section`, `Stat`, `Field`, `Hint`, `NumberField`, `MultiSelect`.
- `RepeaterLoader.tsx` — filinput + drag/drop för SK6BA CSV, visar parse-status (se §2).
- `TargetPickerPanel.tsx` — väljer export-target, läser `targets/registry`.
- `RepeaterFilterPanel.tsx` — `FilterSettings`-UI (status/typ/mode/band/distrikt).
- `ChannelPacksPanel.tsx` — väljer packs + per-pack-policies (`PackPlacement`, `RxOnlyPolicy`, `FreqDupePolicy`).
- `NamingEditor.tsx` — `NamingSettings`-UI.
- `ExportPanel.tsx` — split-inställningar + download-knapp, visar warning-count.
- `PreviewTable.tsx` — tabell över `NormalizedChannel[]` (kolumner: name, rx, tx, tone, type, district).

### Index-routen efter refaktor

`src/routes/index.tsx` ska:
- läsa hooks (`useCodeplugSettings`, `useSavedSk6baExports`, `useSelectedPackChannels`, `useCodeplugPipeline`, `useCodeplugDownload`)
- rendera huvudlayout (header med länkar bevaras) + de 8 panelerna
- inte längre innehålla helper-komponenter, parse-logik, eller download-logik

Mål: under ~200 rader.

### Bevarad UX

Visuell layout, ordning på paneler, knappar, text-strängar, localStorage-nycklar — allt oförändrat. Refaktorn är ren extrahering; ingen ny styling, inga nya kontroller.

## 2. SK6BA-importervalidering

### Ny typ (i `importers/sk6ba.ts` eller intill)

```ts
export type Sk6baLoadState =
  | { status: "empty" }
  | { status: "loaded"; rows: RawRow[]; columns: string[]; rowCount: number }
  | { status: "error"; message: string; missingColumns?: string[] };
```

### Beteende

- `parseSk6baCsv` returnerar fortfarande sin nuvarande form (oförändrat API för befintliga tester).
- Ny wrapper `loadSk6baCsv(text): Sk6baLoadState` används av `RepeaterLoader.tsx`.
- Om obligatoriska kolumner saknas → `{ status: "error", message: "Saknade kolumner: <lista>", missingColumns }`. Inga `rawRows` skickas till pipelinen.
- `useCodeplugPipeline` får `rawRows: RawRow[] | null`; om `null` kör den inte pipelinen.
- `RepeaterLoader` visar tydlig röd alert med listan av saknade kolumner.

### Tester

- Lägg till 2–3 fall i befintliga `__tests__/importers/sk6ba.test.ts`:
  - saknade obligatoriska kolumner → `status: "error"` + `missingColumns` icke-tom
  - korrekt fil → `status: "loaded"` med rätt `rowCount`
- BOM/komma-decimal/semikolon: lägg till **endast om** befintliga tester inte redan täcker det. Snabb genomgång av filen först.

## Det vi INTE gör nu

- Ingen DMR-modellförberedelse (separat tur när första DMR-target är konkret).
- Ingen metadata/dep-städ (separat tur).
- Inga nya testfiler för områden som redan har 130 gröna tester (`naming`, `dedupe`, `frequency`, `tones`, alla targets, `channel_pack`).
- Ingen visuell redesign.

## Acceptanskriterier

- `bun test` grönt (alla 130 + nya importer-tester).
- Bygget grönt.
- `src/routes/index.tsx` < ~200 rader.
- Felaktig SK6BA-fil renderar tydlig felruta med saknade kolumner; ingen pipeline körs.
- CHIRP, VGC N76 och split-export oförändrade (verifieras via befintliga golden tests).
- localStorage-nycklar oförändrade så sparade inställningar överlever refaktorn.

## Risker

Stor extrahering av UI utan UI-tester → manuell rökverifiering av varje panel + download-flöde i preview efter implementation.
