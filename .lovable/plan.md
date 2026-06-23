## Problem

`ExportTarget.exportMany` returnerar `ExportFile[]` — bara filer, inga varningar. När exporten splittras till flera filer går target-warnings (trunkering, digitala mode, RX-only-markerade m.fl.) förlorade i nedladdningsflödet. Single-file-pathen returnerar redan `ExportResult { filename, content, warnings }`, så API:t är inkonsekvent och beroende av att `target.validate(...)` också körs separat i previewen.

## Lösning

Lyft `exportMany` till en `ExportManyResult` som speglar `ExportResult`:

```ts
export interface ExportManyResult {
  files: ExportFile[];
  warnings: Warning[];
}
```

### 1. `src/lib/codeplug/targets/types.ts`

- Lägg till `ExportManyResult`.
- Ändra `ExportTarget.exportMany` signatur till returnera `ExportManyResult`.
- `ExportFile` lämnas oförändrad (filename + content) — varningarna aggregeras på resultatnivå, inte per fil. Per-fil-warnings ger en sämre UX (samma "5 kanaler trunkerades" upprepas i varje chunk).

### 2. Uppdatera varje target

`buildSplitFiles` lämnas oförändrad (returnerar `ExportFile[]`). Varje target wrappar:

- **chirp-generic**: `{ files: buildSplitFiles(...), warnings: chirpDigitalWarnings(channels) }`.
- **vgc-n76**: `{ files: buildSplitFiles(...), warnings: toVgcN76Rows(channels, s).warnings }` (samma källa som `validate`).
- **rt-systems-yaesu**: `{ files: buildSplitFiles(...), warnings: exportRtSystemsYaesuCsv(channels, s).warnings }`.
- **nicsure-rt880**: har ingen exportMany, ingen åtgärd.

Varningar aggregeras över hela kanalsetet (inte per chunk) så användaren ser samma sammanfattning som i preview/single-export.

### 3. `src/hooks/useCodeplugDownload.ts`

- `invokeTarget` returnerar `{ one: ExportResult } | { many: ExportManyResult }`.
- `exportFiles()` returnerar `Promise<Warning[]>` istället för `Promise<void>` — anroparen kan logga/visa varningar. Behåll signaturen `async` så den fortfarande väntar på ZIP-genereringen.
- I single-file-grenen plockar vi `out.one.warnings`, i ZIP-grenen `out.many.warnings`.

### 4. `src/routes/index.tsx`

- `doExport` tar emot varningar från `exportFiles()` och loggar via `console.info` ("Export klar — N varningar"). I denna iteration ändrar vi inte UI för att visa dem — `target.validate(...)`-blocket i preview-panelen ger redan användaren samma information före exporten. Anledningen att skicka dem genom hooken är att stänga API-läckan, inte att duplicera UI.

### 5. Tester

- Uppdatera 9 testcalls i `__tests__/targets/split.test.ts` och `vgc-n76.test.ts` som idag gör `const files = TARGET.exportMany!(...)` — byt till `const { files } = TARGET.exportMany!(...)`.
- Nytt test i `rt-systems-yaesu.test.ts` (eller `split.test.ts`): kör `exportMany` på ett kanalset där minst ett namn är längre än `maxLength`, verifiera `result.warnings` innehåller `rt_name_truncated`.

## Acceptanskriterier

- `exportMany` har typen `(channels, settings, split) => ExportManyResult`.
- ZIP-export från `useCodeplugDownload` exponerar samma varningar som single-file-export gör för motsvarande kanalset.
- Befintliga tester (9 st) uppdaterade och nytt warnings-test gått igenom.
- `bun run verify` grön.
