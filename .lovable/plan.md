## Problem

`parseAccess()` i `src/lib/chirp/tones.ts` splittar access-fältet på `[\s/|,;]+`. Kommatecknet används som separator, så `"1750 / 156,7 / DTMF 6"` blir delarna `["1750", "156", "7", "DTMF", "6"]`. `156` hamnar i CTCSS-intervallet (40–300) och väljs som ton → exporten får `rToneFreq=156.0` istället för `156.7`.

`parseNumberLoose` hanterar redan decimalkomma korrekt (`"156,7"` → `156.7`), så lösningen är att inte använda komma som separator.

## Fix

I `src/lib/chirp/tones.ts`, ändra split-regex från `/[\s/|,;]+/` till `/[\s/|;]+/` (ta bort kommat). Då bevaras `"156,7"` som en del och parseNumberLoose returnerar 156.7.

## Test

Lägg till ett fall i `src/lib/chirp/__tests__/tones.test.ts`:

```ts
it("parses decimal comma in access (e.g. '1750 / 156,7 / DTMF 6')", () => {
  const r = parseAccess("1750 / 156,7 / DTMF 6");
  expect(r.uses1750).toBe(true);
  expect(r.ctcss).toBeCloseTo(156.7);
});
```

Verifiera att övriga tester (separator-mix med flera toner avgränsade med komma utan decimaler) fortfarande passerar — om någon befintlig fixtur använder `,` som ren separator mellan heltalstoner behöver den uppdateras till `/` eller `;`.

## Vad jag inte rör

- Hydrerings-varningen om "5 vs 0" i `ChannelPacksPanel` (annat problem, nämner du om du vill att jag fixar det separat).
- `parseNumberLoose` — den är redan rätt.
