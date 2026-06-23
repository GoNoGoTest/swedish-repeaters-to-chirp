Just nu visas banden i den ordning de dyker upp i källfilen. Vi ska istället sortera dem efter riktig amatörbandsfrekvens, lägst först, med tomt band sist.

### Ändringar

1. **Sorteringshjälp i `src/lib/codeplug/bands.ts`**
   - Lägg till en frekvensbaserad sorteringsordning för alla kända bandkoder.
   - Exportera `sortBands(bands: string[]): string[]` som:
     - Sorterar kända band enligt frekvens (10m, 6m, 4m, 2m, 70cm, 23cm, 13cm, 9cm, 6cm, 3cm, 1,25cm).
     - Lägger okända koder i alfabetisk ordning efter kända band.
     - Lägger tom sträng `""` (visas som "(tom)") sist.

2. **Uppdatera `src/components/codeplug/RepeaterFilterPanel.tsx`**
   - Ersätt `const allBands = Object.keys(summary.uniqueCounts.band);` med sorterad variant: `const allBands = sortBands(Object.keys(summary.uniqueCounts.band));`.
   - Resten av flervalstrukturen för "Band" behöver inte ändras eftersom den redan använder `formatBandLabel` / `parseBandLabel`.

3. **Tester i `src/lib/codeplug/__tests__/bands.test.ts`**
   - Lägg till testfall som verifierar sorteringen, inklusive att `(tom)` hamnar sist och att okända koder inte stör ordningen.

### Noteringar
- Detta är en ren presentationsändring; filtervärdet sparas fortfarande som rå bandkod.
- Inga ändringar i exportlogik eller datamodeller.