# Plan: minimal UI-regressionstape

## Mål

Lås tre konkreta klasser av buggar som nuvarande node-tester missar:

1. **PreviewTable** visar fel preview-mode när target byter (target-specifik mode-resolver används inte).
2. **Target-byte** triggar inte validate-flödet, så RT Systems-specifika varningar (t.ex. analog tone + digital mode) hamnar tyst i preview.
3. **Exkluderingsnyckel** för RX-only / dubbletter glider mellan `channelKey` och `excludedKeys`-mängden (download exporterar ändå rader som UI markerat som exkluderade).

Behåll testbredden minimal: 4–6 tester totalt, fokuserade på regressioner.

## Toolchain

- Lägg `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` som devDependencies.
- Uppdatera `vitest.config.ts`:
  - Behåll `src/**/*.test.ts` i `node`.
  - Lägg `src/**/*.test.tsx` i `jsdom` via `test.projects` (eller `environmentMatchGlobs`-motsvarighet i Vitest 4).
  - `setupFiles: ["./src/test/setup.ts"]` som importerar `@testing-library/jest-dom/vitest`.
- Tester körs fortfarande via `bun run test` / `bun run verify`.

## Tester

### 1. `src/components/codeplug/__tests__/PreviewTable.test.tsx`

- Rendera `<PreviewTable>` med två fixturkanaler (en C4FM, en FM) och en `getExportMode`-stub som returnerar olika strängar per target (`"DN"` för chirp, `"FM"` för rt-systems).
- Assertera att kolumnen "Export" visar exakt det `getExportMode` returnerar — inte `mode_effective`. Detta låser kontraktet att PreviewTable lyder target-resolvern.
- Klick på exkluderings-switchen för rad 1 → `onToggleExclude` anropas med exakt `channelKey(channels[0])`. Låser nyckel-kontraktet.

### 2. `src/components/codeplug/__tests__/channelKey.test.ts` (utöka befintlig)

- Lägg ett case som verifierar att två rader med samma `source_id` men olika `mode_effective` får olika nycklar (RX-only/multi-mode-expansion-fallet).
- Verifiera att `pack_id` ingår så att två channel-pack-rader från olika pack inte krockar.

### 3. `src/hooks/__tests__/useCodeplugDownload.test.tsx`

- Mocka `URL.createObjectURL`, `URL.revokeObjectURL` och stubba `HTMLAnchorElement.prototype.click`.
- Rendera hooken via `renderHook` med en exportChannels-fixtur och settings för `chirp-generic`.
- Anropa `exportFiles()` → assertera att `click` anropas en gång och att Blob-innehållet (fångat via `createObjectURL`-mock) innehåller förväntade CSV-rader.
- Andra case: exportChannels-fixtur där en kanal markerats som RX-only-exkluderad _innan_ hooken anropas (dvs caller ska redan ha filtrerat). Verifierar dokumenterat kontrakt: hooken exporterar exakt det den får — inga dolda filter.

### 4. `src/components/codeplug/__tests__/TargetPickerPanel.test.tsx`

- Rendera target-pickern med kontrollerad `settings`/`setSettings`.
- Klick på "RT Systems Yaesu generic" → `setSettings` kallas med `export.targetId === "rt-systems-yaesu-generic"`.
- Assertera att target-bytet _inte_ nollställer `perTarget` för andra targets (tidigare regression).

## Utanför scope

- Ingen e2e/Playwright.
- Inga tester av `RepeaterFilterPanel`, `ChannelPacksPanel`, `ParseWarningsPanel`, `useCodeplugSettings`-persist.
- Ingen refaktor av komponenterna för att göra dem mer testbara — om något kräver det, notera i PR och hoppa det testet hellre än att ändra produktionskod.

## Verifiering

`bun run verify`. Alla nya tester gröna; befintliga node-tester orörda.
