## Mål

Punkt 9: gör parser- och persistens-lagret striktare med zod, och sluta tysta PapaParse-fel. Tre delar:

1. PapaParse-fel surface:as som warnings i load-state (mjuk hantering — vi behåller raderna Papa fick ut).
2. CSV-radschema med zod för SK6BA och channel-pack (per-rad warnings istället för silent tomma fält).
3. Settings-schema med zod, inkl. typad `perTarget` via `settingsSchema` per target.

## Del 1 — PapaParse-fel som warnings

### SK6BA (`importers/sk6ba.ts`)

`ImportResult` får ett nytt fält:

```ts
export interface ImportResult {
  rows: RawRow[];
  columns: string[];
  missingColumns: string[];
  delimiter: string;
  parseErrors: { row: number | null; code: string; message: string }[]; // ny
}
```

`parseSk6baCsv` mappar `result.errors` → `parseErrors` (rad är 1-indexerad headerless; vi adderar +2 för CSV-radnummer eller `null` om Papa inte vet).

`Sk6baLoadState` får en ny variant `loaded` med `parseWarnings: string[]`:

```ts
| { status: "loaded"; ...; parseWarnings: string[] }
```

`loadSk6baCsv` översätter `parseErrors` till svensktexterad lista (`"Rad 17: Quotes — Unable to auto-detect…"`), klippt till topp-20 med `…och N till`. Fel hanteras "mjukt" — vi returnerar fortfarande `loaded` om kolumner och radmängd är OK.

UI (`Sk6baLoaderPanel` eller motsvarande): visa `parseWarnings` som info-banner under success-statet. Befintliga `error`-fall är oförändrade.

### Channel pack (`importers/channel_pack.ts`)

`PackParseResult.headerWarnings` byter namn → `warnings: string[]` (en union för header- och parse-warnings) eller får ett nytt fält `parseWarnings`. Föredrar nytt fält för att inte bryta callers:

```ts
export interface PackParseResult {
  ...
  headerWarnings: string[];
  parseWarnings: string[]; // ny
}
```

Mappar `result.errors` likadant som SK6BA. Pack-loader UI lägger `parseWarnings` i samma list som `headerWarnings`.

## Del 2 — Zod-schema för CSV-rader

Nytt: `src/lib/codeplug/importers/schemas.ts`.

### SK6BA-radschema

```ts
export const sk6baRowSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  band: z.string().optional(),
  mode: z.string().optional(),
  output: z.string().optional(),     // numerisk parsning sker i normalize()
  tx_shift: z.string().optional(),
  access: z.string().optional(),
  status: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  ...
}).passthrough(); // okända kolumner släpps fram, normalize() ignorerar dem
```

Anropas i `parseSk6baCsv` efter Papa, per rad. Fel pushas till `parseErrors` med radnummer; raden behålls (mjuk hantering — `normalize()` har redan defensiv parsing av strängar).

### Channel-pack-radschema

```ts
export const packRowSchema = z.object({
  pack_id: z.string().min(1),
  source_id: z.string().min(1),
  rx_frequency: z.string().min(1),
  // resten optional
  tx_frequency: z.string().optional(),
  duplex: z.enum(["", "+", "-", "split", "off", "simplex"]).optional(),
  mode: z.string().optional(),
  enabled_default: z.string().optional(),
  tx_allowed: z.string().optional(),
  rx_only: z.string().optional(),
  inferred_from_range: z.string().optional(),
  ...
}).passthrough();
```

Anropas i `parseChannelPackCsv` per rad — ger oss en strukturerad ersättning för dagens ad-hoc `parseBool`/duplex-kontroll. Befintliga rad-`Warning`-pushningar behålls; schema-fel mappas till en ny warning-kod `pack_schema_invalid`.

### Effekt

Vi tar inte bort all befintlig logik i `parseChannelPackCsv` — schemat är ett tunt skal som fångar fel-typer tidigt (t.ex. siffra i `pack_id` är fortfarande sträng, men `enum`-fel på `duplex` blir en strukturerad warning istället för "Okänt duplex" buried i loopen).

## Del 3 — Zod-schema för Settings + per-target

### `src/lib/codeplug/models.ts` → schema-fil

Lägg `src/lib/codeplug/settings.schema.ts` (separat för att undvika cirkulära imports):

```ts
import { z } from "zod";
import { DEFAULT_SETTINGS } from "./defaults";
import { getTarget, listTargets } from "./targets";

const filterSchema = z.object({
  modes: z.array(z.string()).default([]),
  statuses: z.array(z.string()).default([]),
  countries: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  includeUnknownRegions: z.boolean().default(true),
  ...
}).passthrough();

const namingSchema = z.object({...}).passthrough();
const packsSchema = z.object({...}).passthrough();
const sortSchema = z.object({...}).passthrough();
const splitSchema = z.object({
  mode: z.enum(["single", "per_district", "per_district_chunked"]),
  chunkSize: z.number().int().min(1).default(8),
});

export const exportSchema = z.object({
  targetId: z.string(),
  perTarget: z.record(z.unknown()), // valideras per-target nedan
  split: splitSchema,
});

export const settingsSchema = z.object({
  filter: filterSchema,
  naming: namingSchema,
  packs: packsSchema,
  sort: sortSchema,
  export: exportSchema,
});
```

### Per-target `settingsSchema`

`ExportTarget`-interfacet (`targets/types.ts`) får ett valfritt fält:

```ts
interface ExportTarget<TSettings, ...> {
  ...
  /** Zod-schema för target-specifika settings. Används av loaders för att
   *  validera localStorage-data och avgöra om patchen ska tillämpas eller
   *  ersättas av defaults. Valfritt — om frånvarande används defaults
   *  som tidigare. */
  settingsSchema?: z.ZodSchema<TSettings>;
}
```

Inför `settingsSchema` på de fyra befintliga targets (chirp-generic, rt-systems-yaesu, vgc-n76, nicsure-rt880). Existerande `defaultSettings` blir källan för `.default(...)`-värden så schemat producerar samma defaults om fältet saknas.

### `resolveTargetSettings` blir säker

I `targets/registry.ts`:

```ts
export function resolveTargetSettings<T extends AnyExportTarget>(
  target: T,
  stored: Record<string, unknown> | undefined,
): T["defaultSettings"] {
  if (target.settingsSchema) {
    const parsed = target.settingsSchema.safeParse({
      ...(target.defaultSettings as object),
      ...(stored ?? {}),
    });
    if (parsed.success) return parsed.data as T["defaultSettings"];
  }
  return { ...(target.defaultSettings as object), ...(stored ?? {}) } as T["defaultSettings"];
}
```

### `useCodeplugSettings.ts`

`loadStoredSettings` byter ut den manuella merge-kedjan mot:

```ts
const raw = window.localStorage.getItem(STORAGE_KEY);
if (!raw) return DEFAULT_SETTINGS;
const parsedJson = JSON.parse(raw);
const migrated = { ...parsedJson, filter: migrateFilter(parsedJson.filter) };
const result = settingsSchema.safeParse(migrated);
if (!result.success) {
  console.warn("Sparade inställningar ogiltiga, återställer defaults", result.error.format());
  return DEFAULT_SETTINGS;
}
// Validera även perTarget mot resp. target.settingsSchema; outvaliderade ids droppas.
const perTarget: Record<string, unknown> = {};
for (const [id, patch] of Object.entries(result.data.export.perTarget)) {
  const t = getTarget(id);
  if (!t) continue;
  if (t.settingsSchema) {
    const p = t.settingsSchema.safeParse({
      ...(t.defaultSettings as object),
      ...(patch as object),
    });
    perTarget[id] = p.success ? p.data : t.defaultSettings;
  } else {
    perTarget[id] = patch;
  }
}
return { ...result.data, export: { ...result.data.export, perTarget } };
```

`targetId`-fallback från `getTarget(...)` behålls (validerar mot registret, inte bara schemat).

### Saved exports (`saved-exports.ts`)

Befintlig `safeRead` har redan en manuell duck-type. Byt mot ett zod-schema:

```ts
const savedExportSchema = z.object({
  id: z.string(),
  filename: z.string(),
  savedAt: z.number(),
  rowCount: z.number(),
  byteSize: z.number(),
  content: z.string(),
});
const savedExportListSchema = z.array(savedExportSchema);
```

`safeRead` returnerar `savedExportListSchema.safeParse(...).data ?? []`.

## Filer som ändras

- `src/lib/codeplug/importers/sk6ba.ts` — `parseErrors`, `parseWarnings` på load-state, Papa-error-mappning.
- `src/lib/codeplug/importers/channel_pack.ts` — `parseWarnings`, Papa-error-mappning, applicera packRowSchema per rad.
- `src/lib/codeplug/importers/schemas.ts` — ny, `sk6baRowSchema` + `packRowSchema`.
- `src/lib/codeplug/settings.schema.ts` — ny, `settingsSchema` + sub-schemas.
- `src/lib/codeplug/targets/types.ts` — valfritt `settingsSchema` på `ExportTarget`.
- `src/lib/codeplug/targets/{chirp-generic,rt-systems-yaesu,vgc-n76,nicsure-rt880}.ts` — definiera `settingsSchema`.
- `src/lib/codeplug/targets/registry.ts` — använd schemat i `resolveTargetSettings`.
- `src/hooks/useCodeplugSettings.ts` — validera vid load, per-target safeParse.
- `src/lib/codeplug/saved-exports.ts` — `savedExportSchema` ersätter manuell duck-type.
- UI: SK6BA-loader och Pack-loader visar nya `parseWarnings`. Befintliga `Sk6baLoaderPanel`/`PackLoaderPanel` får en liten info-sektion.

## Tester

- `importers/__tests__/sk6ba.papa-errors.test.ts` — CSV med rad som har för få fält → `parseErrors.length > 0` och `loadSk6baCsv` returnerar `loaded` med `parseWarnings`.
- `importers/__tests__/channel_pack.papa-errors.test.ts` — likadant för pack.
- `settings.schema.test.ts` — accepterar default + migrerar legacy; avvisar uppenbart trasig JSON (`filter: 5`).
- `targets/__tests__/registry.test.ts` (eller ny) — `resolveTargetSettings` validerar med schemat när det finns: ogiltigt `maxLength: -1` → defaultas till target.defaultSettings.maxLength.
- `saved-exports.test.ts` — saknat `byteSize`-fält gör att entryt droppas.
- Återanvänd befintliga tester (de ska fortsätta passera).

## Acceptanskriterier

- `loadSk6baCsv("a,b\n\"unterminated")` returnerar `loaded` (eller `error` om header saknas) med icke-tom `parseWarnings`.
- `parseChannelPackCsv` rapporterar Papa-fel via `parseWarnings`.
- localStorage med `settings.export.perTarget["chirp-generic"] = { maxLength: "broken" }` ger defaults för det target, inte en typad surprise.
- `settings.export.perTarget` är fortfarande `Record<string, unknown>` i typen (TS-strikthet får inte regressa), men varje target-bucket valideras vid läsning.
- `bun run verify` grön; nya tester gröna.

## Inte i scope

- Ändra `Settings`-typen till en zod-inferrad typ (det skulle kaskada över hela kodbasen). Vi behåller `Settings` som idag; schemat är en _validation gate_, inte källan till typen.
- Strikt enum för `mode_raw` (SK6BA accepterar fortfarande godtyckliga strängar; `parseModes()` är gatekeepern).
- Ändra `RawRow`-typen från `Record<string, string>`-lik.
