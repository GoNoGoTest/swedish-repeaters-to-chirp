## Problem

`PreviewTable` har en enda `Mode`-kolumn vars värde beräknas som `isPack && c.mode_pack ? c.mode_pack : chirpMode`. För RT Systems, VGC och Nicsure har den nollkoppling till vad targeten faktiskt skriver — en C4FM-rad visas som "NFM" trots att RT Systems exporterar `DN`. Det blir missvisande och dolda buggar slinker förbi.

## Lösning

Varje target ansvarar för sin egen "preview-adapter" som returnerar det mode-token targeten faktiskt skriver i CSV:n. Previewen visar både kanalens signalmode och targetens exportmode.

### 1. `src/lib/codeplug/targets/types.ts`

Lägg till en valfri metod på `ExportTarget`:

```ts
/** Mode-token som targeten faktiskt skulle skriva för den här kanalen. */
previewMode?: (c: NormalizedChannel, settings: TSettings) => string;
```

### 2. Implementera per target

- **chirp-generic**: exportera (eller flytta upp) `resolveMode(c, settings.mode)` och delegera till den.
- **vgc-n76**: återanvänd logiken som redan finns i exportern — pack-läge `AM/FM/NFM` enligt `mode_pack`, annars `FM`/`NFM` enligt `defaultBandwidth`. Digitala SK6BA-rader (som annars droppas) → returnera `mode_effective` så previewen visar att raden inte kommer ut.
- **nicsure-rt880**: motsvarande FM/NFM/AM-mappning.
- **rt-systems-yaesu**: använd befintliga `operatingMode(c).mode` → `FM`/`DN`/(framtid).

Ingen ändring i `validate`/`export` — preview-adaptern delar logik via en intern helper i target-modulen, men ändrar inte exportbeteendet.

### 3. `src/components/codeplug/PreviewTable.tsx`

- Ersätt `Mode`-kolumnen med två: **`Signal`** och **`Export`**.
  - Signal: `c.mode_pack || c.mode_effective || "—"` (pack-rader visar deras `mode_pack`, SK6BA visar kanonisk signal).
  - Export: från ny prop `getExportMode(c)`; fallback till `chirpMode` om callbacken saknas (bakåtkompatibelt för enkla testfall).
- Byt prop `chirpMode: string` till `getExportMode: (c: NormalizedChannel) => string` (obligatorisk).
- Headerrad: ersätt `"Mode"` med `"Signal"` och `"Export"`.

### 4. `src/routes/index.tsx`

Bygg `getExportMode` från aktiv target. Pseudokod:

```ts
const settingsForTarget = /* befintlig resolveTargetSettings-uppslag */;
const getExportMode = (c: NormalizedChannel) =>
  target.previewMode?.(c, settingsForTarget) ?? "—";
```

Ta bort `chirpMode`-prop:en till `<PreviewTable>` (chirp-targetens `previewMode` ger nu samma värde).

### 5. Tester

- `src/lib/codeplug/__tests__/targets/rt-systems-yaesu.test.ts`: verifiera `previewMode(c4fmRow) === "DN"` och `previewMode(fmRow) === "FM"`.
- `chirp-generic.test.ts`: verifiera att en C4FM-rad ger `"DN"` och en FM-rad ger settings.mode (NFM/FM).
- `vgc-n76.test.ts` och `nicsure-rt880.test.ts`: verifiera att pack-rader med `mode_pack=AM` ger `"AM"`, och att SK6BA FM-rader ger `"FM"`/`"NFM"` enligt `defaultBandwidth`.

## Tekniska detaljer

- `previewMode` är rent presentationsbeteende — den anropas inte från exportpipen och kan därför inte påverka filinnehåll. Den ska dock spegla exportlogiken, så vi extraherar mode-mappningen till en delad helper i samma fil och anropar den från både `previewMode` och `export`.
- För targets utan `previewMode` (framtida) visar UI `"—"` i Export-kolumnen. `assertNever`-mönstret tvingar ändå utvecklare att uppdatera schemat per target-id där det redan används.

## Acceptanskriterier

- Med RT Systems Yaesu-target och en C4FM-SK6BA-rad: Signal=`C4FM`, Export=`DN`.
- Med CHIRP-target och samma rad: Signal=`C4FM`, Export=`DN`. Med ren FM-rad: Signal=`FM`, Export=`NFM` eller `FM` beroende på `chirpSettings.mode`.
- Med VGC N76 och pack-rad `mode_pack=AM`: Signal=`AM`, Export=`AM`. SK6BA C4FM-rad (som droppas) visar Signal=`C4FM`, Export=`C4FM` (eller markerat som "skippas" — behåll som `mode_effective` i denna iteration).
- `bun run verify` grön.
