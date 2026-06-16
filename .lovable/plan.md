
# Refactor: pluggbart exportlager

## Mål

Förbereda appen för fler exportformat (näst på tur: VGC N76; senare RT Systems, DMR-varianter osv) utan att röra det som fungerar idag. Import, `NormalizedChannel`, pipeline (filter/sort/dedupe/naming) och UI för repeatrar+kanalpaket lämnas orörda. Inget nytt format implementeras nu — bara CHIRP flyttas in i den nya strukturen så att tillägg av N76 senare bara blir "lägg till en fil i `targets/`".

Bakåtkompatibilitet för sparade `localStorage`-settings nedprioriteras (vi bumpar versionsnyckeln och resettar tyst).

## Centralt koncept: "exportmål" (ExportTarget)

Ett exportmål = en konkret kombination av appstöd och radiogränser som ger en importerbar fil. Exempel:

- `chirp-generic` — CHIRP generic CSV, gränser från en "generic CHIRP"-radio (det vi har idag).
- `vgc-n76` (senare) — N76:s egna CSV, 32 kanaler/grupp, egen maxLength, egna tonkolumner.
- `rt-systems-ftm500` (senare) — RT Systems CSV för en specifik Yaesu-radio.

Vissa dialekter (t.ex. CHIRP) kan i framtiden återanvändas av flera mål med olika gränser; men det är en optimering — vi börjar med "ett mål = en exporter + en gränsuppsättning".

## Ny struktur

```text
src/lib/chirp/                    (behålls; namnet "chirp" är historiskt)
  exporters/
    chirp.ts                      (oförändrad implementation, blir leverantör till chirp-generic-målet)
  targets/                        (NY)
    types.ts                      (ExportTarget, HardwareLimits, ExportContext, ExportResult)
    registry.ts                   (registerTarget / listTargets / getTarget)
    chirp-generic.ts              (registrerar CHIRP-målet, defaults, validering, anropar exporters/chirp.ts)
    index.ts                      (importerar alla targets så registret fylls vid app-start)
```

### `types.ts` (skiss, inte slutgiltig kod)

```text
HardwareLimits {
  maxChannels?: number
  maxChannelsPerGroup?: number
  maxNameLength: number
  supportedModes: Array<"NFM"|"FM"|"AM"|"USB"|"LSB"|"CW"|"DMR"|"DSTAR"|"C4FM"|...>
  supportsSplit: boolean
  supportsCtcss: boolean
  supportsDcs: boolean
  toneStepHz?: number[]
}

ExportTarget<TSettings> {
  id: string                      // "chirp-generic"
  label: string                   // "CHIRP generic CSV"
  vendor: string                  // "CHIRP"  — för gruppering i UI
  fileExtension: "csv" | "txt" | ...
  limits: HardwareLimits
  defaultSettings: TSettings
  validate?(channels, settings): Warning[]   // pre-export validering mot limits
  export(channels: NormalizedChannel[], settings: TSettings): ExportResult
}

ExportResult { filename: string; content: string; warnings: Warning[] }
```

### `chirp-generic.ts`

Wrappar nuvarande `exportChirpCsv` + `ChirpSettings`. Ingen logikändring; bara registrering.

## Settings-modell

`Settings.chirp` ersätts av ett generiskt schema. Versionsnyckeln i `localStorage` bumpas från `sk6ba-chirp-settings-v4` till `v5`, gammal nyckel ignoreras (ingen migrationskod).

```text
Settings {
  filter, naming, sort, packs            // oförändrade
  export: {
    targetId: string                     // default "chirp-generic"
    perTarget: Record<string, unknown>   // typad via target.defaultSettings vid läsning
  }
}
```

`ChirpSettings.maxLength` blir kvar i CHIRP-målets settings (där den hör hemma: hårdvarugräns för radions display). Inget flyttas till `NamingSettings`.

Nya warning-koder reserveras: `exceeds_max_channels`, `exceeds_group_size`, `unsupported_mode_for_target`, `name_too_long_for_target`.

## UI-ändringar (minimala i denna runda)

I `Sortering & CHIRP-export`-sektionen i `src/routes/index.tsx`:

1. Lägg till en målväljare överst: `<select>` grupperad per `vendor`, listar `registry.listTargets()`. Default `chirp-generic`.
2. Rendera målets settings-panel via en liten dispatcher. CHIRP-panelen flyttas ut från `ExportPanel` till `targets/chirp-generic.panel.tsx` (samma fält som idag: startLocation, mode, tStep, skipLinks, maxLength).
3. Exportknappens text blir `Exportera {target.label} ({n})` och anropar `target.export(...)` istället för `exportChirpCsv` direkt.
4. Visa eventuella `target.validate()`-varningar (t.ex. för många kanaler för radion) ovanför exportknappen — utan att blockera om man inte vill.

Inga ändringar i repeater-, kanalpakets- eller preview-sektionerna.

Sektionsrubriken byts från `Sortering & CHIRP-export` till `Sortering & export`.

## Tester

- `targets/registry.test.ts`: register tar emot mål, hittar via id, kastar på dubblett-id.
- `targets/chirp-generic.test.ts`: målet producerar identisk output med nuvarande `exportChirpCsv` för en uppsättning fixturer (regressionsskydd — vi får inte ändra CHIRP-output).
- Behåll alla befintliga tester i `__tests__/exporters/chirp.test.ts` orörda. De fortsätter testa `chirp.ts` direkt.
- Snapshot av CSV-headern via målet, så att framtida targets inte oavsiktligt kan ändra CHIRP-kolumnordningen.

## Vad som *inte* görs nu (medvetet uppskjutet)

- VGC N76-exporter, N76-UI för kanalgrupper, 32/grupp-uppdelning.
- RT Systems-varianter.
- DMR/digitala mode-fält i `NormalizedChannel` (kräver att import/Marks-CSV-mappningen utökas; egen plan).
- Per-radio bandfilter, automatisk skip-out av kanaler som överskrider limits.
- Tillämpning av `HardwareLimits` (utöver att lagra dem och köra `validate`). Faktisk trunkering/uppdelning per radio kommer när första radiospecifika målet implementeras.

## Tekniska detaljer / risker

- "chirp"-namnet i mappstrukturen (`src/lib/chirp/`) blir missvisande när andra format finns. Vi behåller det i denna refactor för att minimera diff; en eventuell omdöpning till `src/lib/radio/` kan göras som separat städ-PR.
- `Pipeline.duplicateStop` och övrig pipeline-logik är format-agnostisk och rörs inte.
- Filnamnsgenerering (idag hårdkodat `chirp.csv` i `download(...)`) byts till `${target.id}.${target.fileExtension}` eller liknande.
- Sparade exporter i localStorage (SK6BA-CSV-cache) är input-relaterade och påverkas inte.

## Leverans

En PR/iteration som:

1. Skapar `targets/`-strukturen och flyttar in CHIRP som första mål.
2. Bumpar settings-versionen och uppdaterar `loadStoredSettings`.
3. Lägger till målväljare + dispatcher i export-sektionen.
4. Lägger till registertester + CHIRP-regressionstest.

Efter mergen kan VGC N76 läggas till i en separat, mycket mindre PR: en fil i `targets/`, en panel-komponent, och eventuellt nya fält i `NormalizedChannel` om N76 behöver något vi inte redan har.
