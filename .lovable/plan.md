## Mål

Installera Vitest och bygga en testsvit som täcker importer, pipeline, naming, export och channel pack-stöd enligt punkt 1–23 i specen.

## Steg

1. **Installera devberoenden**
   - `vitest`, `@vitest/ui`, `@types/node` (om saknas)
   - Lägg till `"test": "vitest run"` och `"test:watch": "vitest"` i `package.json`
   - Skapa minimal `vitest.config.ts` med alias `@` → `src` (matchar Vite-config)

2. **Testkatalog**
   - `src/lib/chirp/__tests__/` med en fil per modul

3. **Testfiler och täckning**

   - `frequency.test.ts` — parse av MHz-strängar, shift-tolkning (`+`, `-`, `±`, numeriska kHz/MHz), edge cases
   - `tones.test.ts` — CTCSS-parsning ur access-fältet (Hz, "1750", DCS), normalisering till CHIRP-toner
   - `naming.test.ts` — komponentordning, maxlängd-trunkering, smart-join utan dubbla separatorer, tomma tokens, kollisionssuffix
   - `filters.test.ts` — default-filter (Repeater/Link/Hotspot), mode=FM, exkludering av digitala lägen
   - `geohash.test.ts` / `sorting.test.ts` — sort stabilitet, geohash-fallback när koordinater saknas
   - `importers/sk6ba.test.ts` — parsning av exempelraderna från Marks-CSV (litet inline-fixture), tx_shift, access, comment-bevarande av 1750
   - `importers/channel_pack.test.ts` — CSV-parsning, validering av obligatoriska fält, `rx_only`, `tx_allowed`, `license_note`, varning vid duplicerade `source_id` (ej hård-fail)
   - `channel_packs/registry.test.ts` — laddar medföljande 2 m/70 cm-pack, kontroll av antal kanaler och band-metadata
   - `dedupe.test.ts` — frekvenskollision mellan SK6BA och pack enligt policy
   - `pipeline.test.ts` — end-to-end: SK6BA + pack → placement `prepend`/`append`/`merge_sort`, namn-kollisioner globalt, RX-only-policy (`Duplex=off` vs skip)
   - `exporters/chirp.test.ts` — CHIRP-CSV-header och radformat, `Duplex=split` med `tx_frequency`, `Comment` innehåller license_note + 1750/access, korrekt escaping

4. **Fixtures**
   - `src/lib/chirp/__tests__/fixtures/sk6ba-sample.csv` — minimal utdrag (~10 rader) som täcker repeater, link, hotspot, 1750, CTCSS, digital (filtreras bort)
   - Återanvänd befintliga `channelpacks/*.csv` via `?raw`-import eller `fs.readFileSync` i Node-testmiljön

5. **Konfiguration**
   - `vitest.config.ts`: `environment: 'node'`, inkludera `.csv?raw` via samma plugin-setup som Vite (eller läs filer med `fs` för enkelhet)

6. **Verifiering**
   - Kör `bun run test` → alla gröna
   - Kör `npx tsc --noEmit` → fortsatt grön

## Teknik

- Inga ändringar i produktionskoden förväntas, men om ett test avslöjar en bugg lagas den i samma omgång och noteras i svaret.
- Tester körs i Node-miljö (ingen jsdom behövs — ingen UI testas i denna omgång).
- UI-komponenter (`src/routes/index.tsx`) testas ej nu; fokus på ren logik per spec.

## Ej i scope

- Komponent-/E2E-tester
- CI-konfiguration
- Nya channel pack-CSV:er
