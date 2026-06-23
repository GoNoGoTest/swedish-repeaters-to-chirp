## Mål

Två små disciplinfixar i `swedish-repeaters-to-codeplug`, plus regressionstester.

---

### 1. Gör `applyFreqDedupe()` immutabel

**Fil:** `src/lib/codeplug/dedupe.ts`

Idag muteras input via `ch.warnings.push(...)`. Eftersom pack-kanaler kan komma från cache kan varningar ackumuleras mellan rerenders.

**Ändring:**

- Bygg grupper som idag.
- Bestäm vilka pack-rader som ska få `freq_duplicate` (samma villkor som nu: pack-vs-sk6ba eller pack-vs-pack).
- Bygg en `Set<NormalizedChannel>` `warnSet` för rader att flagga.
- Returnera ny `channels`-array. För rader i `warnSet` returneras en grund-kopia `{ ...c, warnings: [...c.warnings, { code: "freq_duplicate", message }] }`. Hoppa över om kanalen redan har en `freq_duplicate`-warning (idempotent).
- För `dropIds`: filtrera mot identiteten på den ursprungliga `c` (innan ev. kopiering) — alltså bestäm drop på originalreferenser, bygg sedan kept-arrayen och kopiera de som ska få ny warning, så att `dropped` fortsatt pekar på originalobjekt.
- Inga `.push()` på `ch.warnings` någonstans i filen.
- Behåll semantik för `keep_both`, `drop_pack`, `drop_sk6ba`, `stop`.

**Test:** utöka `src/lib/codeplug/__tests__/dedupe.test.ts`:

- Två kanaler (sk6ba + pack) på samma RX. Spara `originalPackWarnings = pack.warnings`, `originalSk6baWarnings = sk6ba.warnings`. Kör `applyFreqDedupe([sk6ba, pack], "keep_both")`. Asserta:
  - `pack.warnings === originalPackWarnings` (oförändrat, samma referens).
  - `sk6ba.warnings === originalSk6baWarnings`.
  - I resultatet: pack-raden har `freq_duplicate`, sk6ba-raden inte.
- Kör funktionen två gånger på samma input och asserta att antalet `freq_duplicate`-warnings i andra körningens resultat fortfarande är 1 (ackumuleras inte) — och att originalobjektens warnings.length är 0.
- Lägg test för `drop_pack`: `dropped`-arrayen innehåller originalreferensen till pack-raden.

---

### 2. Korrekt `Loc` i filtrerad preview

**Problem:** `PreviewTable` räknar Loc lokalt från `startLoc` över bara de rader den får. När `statFilter` aktiveras visas en delmängd och Loc börjar om från 1.

**Ändring i `src/routes/index.tsx`:**

- Bygg `locationByKey: Map<string, number>` via `useMemo` över `pipeline.channels` i exportordning:
  - Startvärde = `target.id === "chirp-generic" ? chirpSettings.startLocation : 1`.
  - Hoppa över exkluderade nycklar (`excludedKeys.has(key)`).
  - Sätt `map.set(channelKey(c), loc++)`.
- Skicka in en `getExportLocation: (c) => number | null`-callback till `PreviewTable` istället för `startLoc`.

**Ändring i `src/components/codeplug/PreviewTable.tsx`:**

- Ersätt prop `startLoc: number` med `getExportLocation: (c: NormalizedChannel) => number | null`.
- I rad-render: `const locNum = getExportLocation(c); const loc = excluded || locNum == null ? "—" : String(locNum);`
- Ta bort lokal `locCounter`.

**Test:** uppdatera `src/components/codeplug/__tests__/PreviewTable.test.tsx`:

- Befintliga tester: byt `startLoc={1}` mot `getExportLocation={() => null}` eller en passande stub (de testar inte Loc — null/—).
- Nytt test: tre kanaler A, B, C. Preview visar bara C. Skicka `getExportLocation`-map där A=1, B=2, C=3. Asserta att enda dataradens Loc-cell (kolumnindex 2) innehåller `"3"`, inte `"1"`.
- Nytt test: exkluderad rad → Loc visas som `"—"` även om callback skulle returnera nummer (den nuvarande `loc === "—"` när exkluderad bevaras).

---

### Verifiering

`bun run verify` ska vara grön (lint, typecheck, test, format, build).

### Utanför scope

- Ingen ändring av `channelKey`, exportformat, statistikfilterlogik eller modeller.
- Ingen omarbetning av övriga targets eller pipeline.
