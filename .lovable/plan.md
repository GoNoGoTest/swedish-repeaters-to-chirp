# Två smala fixar: ta bort missing_access_tone + tolka "Duplex N"

## 1. Ta bort `missing_access_tone`

**`src/lib/codeplug/pipeline.ts`** — i `applyPostExpansionAccessWarnings()`, ta bort hela blocket som skapar `missing_access_tone`. Behåll `ctcss_and_dcs` exakt som den är (SK6BA + analog + båda CTCSS och DCS). Uppdatera även doc-kommentaren ovanför funktionen och kommentaren vid `normalize()` (rad ~78) så den inte längre nämner `missing_access_tone`.

**`src/lib/codeplug/models.ts`** — ta bort `"missing_access_tone"` ur `WarningCode`-unionen. Eventuella switch/branches som matchar koden (UI-text, ikoner) tas också bort. Snabb sökning visar bara unionen — verifierar resten under implementation.

**Tester** — i `__tests__/pipeline.modeSubset.test.ts`:

- "FM utan access → missing_access_tone" → ändras till "FM utan access ger ingen missing_access_tone".
- "FM access=carrier → ingen missing_access_tone" → behåll (fortfarande korrekt).
- "FM access='no tone' → ingen missing_access_tone" → behåll.
- "FM med både CTCSS och DCS → ctcss_and_dcs" → behåll.
- DMR-fallet (inga access-varningar) → behåll.
- Pack-fallet → behåll.

## 2. Tolka "Duplex N" i `parseShift()`

**`src/lib/codeplug/frequency.ts`** — innan `parseNumberLoose(s)`-anropet, matcha `^duplex\s+([+-]?\d+(?:[.,]\d+)?)$/i` och använd capture-gruppen som numerisk input. Övrig logik (0 → simplex, negativ → "-", positiv → "+") oförändrad.

```ts
const duplexMatch = s.match(/^duplex\s+([+-]?\d+(?:[.,]\d+)?)$/i);
const numericInput = duplexMatch ? duplexMatch[1] : s;
const n = parseNumberLoose(numericInput);
```

**Tester** — i befintlig `frequency.test.ts`, lägg till:

- `parseShift("Duplex 0")` → `{ duplex: "", offset: 0, shift: 0, unclear: false }`.
- `parseShift("Duplex -2")` → `{ duplex: "-", offset: 2, shift: -2, unclear: false }`.
- `parseShift("Duplex +0.6")` → `{ duplex: "+", offset: 0.6, shift: 0.6, unclear: false }`.
- `parseShift("Duplex +0,6")` → motsvarande (decimalkomma).

## Verifiering

`bun run verify`. Snapshot-tester för VGC/NiCSURE/RT Systems Yaesu — om en fixture-rad innehöll "Duplex N" som tidigare blev `unclear_shift`, kan output ändras; uppdatera snapshot i så fall. Inga andra targets bör påverkas.
