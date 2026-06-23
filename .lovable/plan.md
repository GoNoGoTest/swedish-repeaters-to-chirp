## Mål

Ersätt den platta `parseWarnings: string[]`-listan med en strukturerad, expanderbar varningspanel som visar rad, kolumn (när vi vet), kod och meddelande per Papa-fel — för både SK6BA och kanalpaket.

## Datamodell

Befintliga `parseWarnings: string[]` i `Sk6baLoadState` och `PackParseResult` byts mot strukturerade objekt. Vi behåller dock fältnamnet och adderar bara struktur.

```ts
// src/lib/codeplug/importers/schemas.ts
export interface ParseWarning {
  /** 1-indexerat CSV-radnummer inklusive header, eller null om okänt. */
  row: number | null;
  /** Kolumnnamn när Papa/schemat kan utpeka en (FieldMismatch / zod-path), annars null. */
  column: string | null;
  /** Strukturell felkod, t.ex. "TooFewFields", "schema_invalid", "MissingQuotes". */
  code: string;
  /** Mänsklig text — Papas meddelande eller zod-issue.message. */
  message: string;
  /** Källa: "papa" (CSV-parser) eller "schema" (zod row-schema). */
  source: "papa" | "schema";
}
```

`formatPapaError` blir `toParseWarning(...)` som producerar `ParseWarning`.

### sk6ba.ts

- `ImportResult.parseErrors: ParseWarning[]` (idag `ParseIssue[]`).
- `Sk6baLoadState`-varianten `loaded` får `parseWarnings: ParseWarning[]` istället för `string[]`.
- Mappningen vid schema-fel använder `issue.path[0]` som `column` när det är en sträng.

### channel_pack.ts

- `PackParseResult.parseWarnings: ParseWarning[]` istället för `string[]`.
- Schema-fel pekar ut kolumn via `zod`-issue `path[0]`.
- `loadMergedPacks()` aggregerar `parseWarnings` (idag bara `headerWarnings`). Lägg `parseWarnings: ParseWarning[]` på `MergedPack`.

## UI-komponent: `ParseWarningsPanel`

Ny `src/components/codeplug/ParseWarningsPanel.tsx`. Återanvändbar.

Props:

```ts
{
  title: string;              // "Parse-varningar i SK6BA-filen" / "Parse-varningar i kanalpaket"
  warnings: ParseWarning[];
  /** Hur många rader som visas innan expand. Default 3. */
  initialVisible?: number;
}
```

Beteende:

- Returnerar `null` om listan är tom.
- Renderar som `<details>` (semantisk expand) med `<summary>` som visar antal + första radnummer:
  `"3 parse-varningar (rad 7, 12, 19) — visa detaljer"`.
- I default-stängt läge visas `summary` + de första `initialVisible` raderna i en kompakt tabell. När `<details>` öppnas visas hela tabellen.
- Tabellkolumner: Rad · Kolumn · Kod · Meddelande. `Rad`/`Kolumn` visar `—` om null. `Kod` får monospace + mindre font; `Meddelande` wrappar.
- När `warnings.length > 50`: visa de första 50 och en fotnot `"… och N till (filtrera CSV:n för fler detaljer)"` — vi undviker att rendera tusentals rader.
- Färgsättning: ärver `amber`-paletten som redan används i RepeaterLoader för parse-warnings.
- Inga inline-styles; semantiska tokens / Tailwind via befintlig stil.

ASCII-skiss:

```text
┌────────────────────────────────────────────────────┐
│ ⚠ 5 parse-varningar (rad 7, 12, 19, …)  [expandera]│  ← <summary>
├────────────────────────────────────────────────────┤
│ Rad │ Kolumn │ Kod          │ Meddelande           │
│  7  │   —    │ TooFewFields │ Too few fields…      │
│ 12  │ duplex │ schema_invali│ Okänt duplex-värde   │
│ 19  │   —    │ TooFewFields │ Too few fields…      │
│                                       (… och 2 till)│
└────────────────────────────────────────────────────┘
```

## Integrationer

### `RepeaterLoader.tsx`

Ersätt den nuvarande inline-`<ul>` av strängar med `<ParseWarningsPanel title="Parse-varningar i SK6BA-filen" warnings={loadState.parseWarnings} />` i `loaded`-grenen.

### `ChannelPacksPanel.tsx`

Pack-warnings har idag ingen UI. Lägg `<ParseWarningsPanel ... />` i panelens header per pack (eller en aggregerad sektion). Begränsad omfattning: en aggregerad sektion längst upp som visar warnings för alla loadade pack med `pack_id` som extra kolumn vore optimalt, men för att hålla skopet enkelt: bara visa när någon pack har warnings, med pack-id som prefix i `title`.

Konkret: lägg en sektion ovanför pack-listan:

```tsx
{mergedPacks
  .filter((p) => p.parseWarnings.length > 0)
  .map((p) => (
    <ParseWarningsPanel
      key={p.packId}
      title={`Parse-varningar i kanalpaket ${p.packId}`}
      warnings={p.parseWarnings}
    />
  ))}
```

## Tester

- `ParseWarningsPanel.test.tsx`: render med 0 warnings ⇒ `null`. Render med 5 warnings, default `initialVisible=3` ⇒ visar 3 rader i stängt läge, alla 5 efter `<details>`-toggle (öppna via `open`-attribut i test).
- `__tests__/importers/sk6ba.papa-errors.test.ts`: uppdatera så att den verifierar `ParseWarning`-struktur (row/column/code/message/source) istället för bara strängar.
- `__tests__/importers/channel_pack.papa-errors.test.ts`: samma.
- Ny test: schema-fel på `duplex="banana"` ⇒ warning med `column: "duplex"` och `source: "schema"`.

## Filer som ändras

- `src/lib/codeplug/importers/schemas.ts` — `ParseWarning`, `toParseWarning`.
- `src/lib/codeplug/importers/sk6ba.ts` — använda strukturen, droppa `summarizeParseIssues`.
- `src/lib/codeplug/importers/channel_pack.ts` — använda strukturen, `parseWarnings: ParseWarning[]`.
- `src/lib/codeplug/channel_packs/registry.ts` — propagera `parseWarnings` genom `MergedPack`.
- `src/components/codeplug/ParseWarningsPanel.tsx` — ny.
- `src/components/codeplug/RepeaterLoader.tsx` — använd nya panelen.
- `src/components/codeplug/ChannelPacksPanel.tsx` — visa panelen för pack med warnings.
- Tester: uppdatera + lägg till enligt ovan.

## Acceptanskriterier

- En SK6BA-CSV med två "TooFewFields"-rader visar en panel med `summary` `"2 parse-varningar (rad X, Y)"` och en tabell med rad/kolumn/kod/meddelande.
- Panelen är stängd vid första render; expand visar full tabell.
- När >50 warnings: visar 50 + fotnot, inte alla.
- Pack med parse-fel renderar motsvarande panel i ChannelPacksPanel.
- `bun run verify` grön; tester gröna.

## Inte i scope

- Filtrering/sökning i warning-tabellen.
- Klicka-på-rad-och-hoppa-till-CSV (vi har ingen CSV-viewer i appen).
- Export av warning-listan.
- Pack-varningar visas inte i `loadMergedPacks`-resultatet om någon caller utanför `ChannelPacksPanel` använder det (idag finns ingen sådan).
