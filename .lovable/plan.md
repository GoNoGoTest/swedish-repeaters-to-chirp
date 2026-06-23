## Mål
Band-multiselecten i RepeaterFilterPanel visar idag råa SK6BA-koder ("2", "70", "23", "6cm", "1.5"). Visa istället amatörbandens vanliga namn på knappetiketten, utan att ändra filtervärden eller importlogik.

## Mapping (label-only)
Definiera en `BAND_LABELS` i `src/lib/codeplug/modes.ts` (eller bredvid, t.ex. ny `bands.ts` — vi lägger i `modes.ts` om passande, annars liten ny fil `src/lib/codeplug/bands.ts`):

| Råkod | Visad etikett |
|-------|---------------|
| `2`   | `2m`          |
| `4`   | `4m`          |
| `6`   | `6m`          |
| `10`  | `10m`         |
| `70`  | `70cm`        |
| `23`  | `23cm`        |
| `13`  | `13cm`        |
| `9`   | `9cm`         |
| `3`   | `3cm`         |
| `6cm` | `6cm`         |
| `1.5` | `1,25cm`      |
| `""`  | `(tom)`       |

Okända koder visas oförändrade.

Helper: `formatBandLabel(raw: string): string`.

## Ändringar
1. **Ny fil `src/lib/codeplug/bands.ts`** med `BAND_LABELS` och `formatBandLabel()`.
2. **`src/components/codeplug/RepeaterFilterPanel.tsx`** — byt Band-`MultiSelect` till encode/decode på samma sätt som Land:
   - `options={allBands.map(formatBandLabel)}`
   - `value={settings.filter.bands.map(formatBandLabel)}`
   - `onChange`: mappa tillbaka label → råkod via reverse-lookup; okända label = label själv.
3. **Liten test** i `src/lib/codeplug/__tests__/` (ny `bands.test.ts`) som verifierar mappningen för kända + okända koder.

## Ej i scope
- Ingen ändring av `band`-fältet i `NormalizedChannel`, filterlogik, eller export.
- Preview-tabell och andra UI-ställen lämnas oförändrade i denna PR (kan följa upp om önskat).

## Öppen fråga
Bekräfta `1.5` → `1,25cm` (svensk decimal) eller hellre `1.25cm` / lämna som `1.5`?
