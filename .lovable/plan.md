## Mål

Sänk kostnaden för att lägga till nya exportmål (närmast Icom IC-705) genom att lyfta upp återkommande mönster i en delad exporter-runtime. Pipeline, importers och själva fil-/CSV-utgången från befintliga targets ska vara bit-identiska efter refaktorn.

Eftersom IC-705-CSV-formatet inte är fastställt än är målet att en framtida IC-705-target ska kunna byggas som **en fil**: en kolumn-tabell + en mode-map + ett par overrides. Ingen ny logik för parsning, varningar, splittning eller naming.

## Leveranser

Tre patches, sekventiella, var och en grön på `bun run verify` innan nästa.

### Patch 1 — Deltyper + delade formatters (icke-funktionell)

Inför namngivna sub-records i `models.ts` och komponera dem in i `NormalizedChannel` så publik typ förblir bakåtkompatibel:

```text
NormalizedChannel = ChannelSource
                  & ChannelMode
                  & ChannelFrequency
                  & ChannelAnalogAccess
                  & ChannelDigitalAccess
                  & ChannelLocation
                  & ChannelPackMeta
                  & ChannelNaming
                  & { warnings: Warning[] }
```

Snittpunkter låses så vi slipper bikeshedding senare:

- `is_analog_fm` → `ChannelMode` (härlett från mode, inte access).
- `mode_pack` → `ChannelPackMeta` (men exporters får läsa det parallellt med `mode_effective` — ingen ändring).
- `tx_allowed` / `rx_only` → `ChannelPackMeta` (de existerar bara i pack-kontexten i praktiken; för SK6BA-rader är default `true/false`).
- `warnings` lämnas på toppen — det är tvärsnitt.

Skapa nya delade formatters i `src/lib/codeplug/exporters/shared/`:

- `formatFrequencyMHz(hz)` — befintlig logik centraliserad.
- `formatDuplexOffset(freq: ChannelFrequency, opts)` — gemensam, varje target väljer hur `"split"`-degradering ska se ut.
- `formatAnalogTone(access: ChannelAnalogAccess)` → `{ tone, rtone, ctone, dtcs, polarity }`.
- `formatDigitalAccess(mode: ChannelMode, dig: ChannelDigitalAccess)` → mode-aware text.

Existerande exporters (chirp.ts, vgc-n76.ts, nicsure-rt880.ts, rt-systems-yaesu.ts) plus exporters/chirp.ts uppdateras att **konsumera** dessa formatters där de redan gör exakt detta — men endast där bytet är 1:1. Allt annat lämnas orört. Snapshot-testerna är ekvivalenslås.

Acceptans: identiska snapshot-utdata, inga `as`-cast, inga ändringar i `pipeline.ts` / `importers/`.

### Patch 2 — Mode-map-modul + RowMapper-kontrakt

**Mode-map-modul** `src/lib/codeplug/exporters/shared/modeMap.ts`:

```ts
type ModeMap = Partial<Record<KnownMode, string | null>>;
function resolveTargetMode(c: ChannelMode, map: ModeMap, fallback?: string): string | null;
```

Varje target deklarerar bara sin tabell. `mapEffectiveMode` i chirp/vgc/nicsure/rt-yaesu byts mot `resolveTargetMode(c, CHIRP_MODE_MAP)` etc. `null` = unsupported (befintlig semantik).

**RowMapper-kontrakt** `src/lib/codeplug/exporters/shared/rowMapper.ts`:

```ts
interface RowMapper<TSettings, TCols extends string> {
  columns: readonly TCols[];
  toRow(c: NormalizedChannel, ctx: { index: number; settings: TSettings }): Record<TCols, string>;
}
function renderCsv<T, C extends string>(channels, mapper, settings, opts?): string;
```

`renderCsv` äger CSV-escape, BOM, radslut, header. Bytena ska vara _byte-för-byte_ identiska med befintlig export — verifieras genom att snapshot-testerna inte ändras.

Konvertera chirp-generic först (enklast, har redan tydlig kolumn-lista). Sedan vgc-n76, nicsure-rt880, rt-systems-yaesu en i taget; om någons CSV-utgång inte är ren tabell-mapping (t.ex. VGC's grupp-/APRS-injektion) behåller den sin nuvarande renderare och tar bara `RowMapper` för själva radmappningen — splittning/insättning sker fortsatt i target-koden.

Acceptans: alla snapshots oförändrade. Targets blir tydligt kortare; ny target kan skrivas mot kontraktet.

### Patch 3 — Test-fixture-builder + `defineTarget()`-helper

**Fixture-builder** `src/lib/codeplug/__tests__/helpers/makeChannel.ts`:

```ts
function makeChannel(overrides?: DeepPartial<NormalizedChannel>): NormalizedChannel;
function makeAnalogRepeater(overrides?: ...): NormalizedChannel;
function makeC4fmRepeater(...): NormalizedChannel;
function makePackChannel(...): NormalizedChannel;
```

Defaults fyller ALLA fält (klassificerade per deltyp så det är lätt att se vad som saknas vid framtida fältutökning). Befintliga test-helpers (`helpers.ts`) får interna omskrivningar att delegera till `makeChannel`, men deras publika API ändras inte — undviker dominoeffekt i ~30 testfiler.

**`defineTarget()`-helper** `src/lib/codeplug/targets/defineTarget.ts`:

```ts
function defineTarget<TSettings, TCols extends string>(spec: {
  id;
  label;
  vendor;
  fileExtension;
  filenameBase?;
  limits;
  defaults;
  settingsSchema;
  modeMap;
  mapper: RowMapper<TSettings, TCols>;
  validate?;
  resolveMaxNameLength?;
  previewMode?;
  supportsSplit?: boolean; // → standardiserad exportMany via buildSplitFiles
}): ExportTarget<TSettings>;
```

Detta är "klistret" — när tabell + map + defaults är skrivna behöver en ny target inte deklarera `export` och `exportMany` själv. chirp-generic konverteras som referens-implementation; övriga targets lämnas oförändrade men kan migreras opportunistiskt senare. Skapar inga regressionsrisker för icke-migrerade targets.

Acceptans: snapshots oförändrade; chirp-generic.ts blir tydligt kortare; ny target = en fil ≈ 80–120 rader.

## IC-705-readiness

När CSV-spec landar är arbetet:

1. Skapa `icom-ic705.ts`: `MODE_MAP` (FM/NFM/AM/USB/LSB/CW/DV), kolumn-tabell, defaults + schema, `defineTarget(...)`, `registerTarget(...)`.
2. Lägga till `"icom-ic705": IcomIc705Settings` i `TargetSettingsMap`.
3. Snapshot-test mot referens-CSV när sådan finns.

Inga ändringar i pipeline, models eller importers krävs.

## Risker & motåtgärder

- **Snapshot-drift av misstag**: varje patch körs mot fullt snapshot-suite innan merge. Om en snapshot ändras är det en regression, inte en accepterad uppdatering.
- **Subtila typincompabiliteter vid composition (`&`)**: vi undviker `Pick<>`-baserade subtyper i deltyperna; allt är platta `interface` som lyfts ut. Ingen användning av `as`.
- **Test-helpers breddningar**: behåll befintliga publika helper-signaturer; `makeChannel` är _adderande_.
- **Targets som inte är ren tabell-mapping (VGC APRS-slot, NiCSURE-zoner)**: dessa migreras till RowMapper _endast_ för radmappningen; specialinjektion ligger kvar i target-koden. Inget tvång att passa allt genom `defineTarget`.

## Inte i scope

- Refaktor av `pipeline.ts`, importers, varningsmodellen, naming, sorting, packregistret.
- Förändringar av faktisk CSV-utgång för existerande targets.
- Implementation av IC-705-targeten (separat patch när CSV-format finns).
- Refactor av VGC/NiCSURE specialfall (grupp-32, zon-pool) utöver att de börjar använda RowMapper för radnivå.

## Verifiering per patch

`bun run verify`. Specifikt: snapshot-tester under `targets/__snapshots__/` måste vara oförändrade efter patch 1 och 2. Efter patch 3 får endast chirp-generic-relaterade test-implementationer (inte snapshots) ha ändrats.
