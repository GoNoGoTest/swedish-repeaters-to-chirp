## Mål

Behandla `type = "uW QTH"` som utanför appens scope: de filtreras bort tidigt, syns inte i Typ-filtret, och redovisas separat i tooltipen för "Bortfiltrerade".

## Ändringar

### 1. `src/lib/codeplug/pipeline.ts`

- Lägg till exporterad konstant:
  ```ts
  export const OUT_OF_SCOPE_TYPES = new Set(["uW QTH"]);
  ```
- I `runPipeline`, direkt efter `normalize(sk6baRows)`:
  ```ts
  const inScope = normalized.filter((c) => !OUT_OF_SCOPE_TYPES.has(c.type));
  const outOfScopeCount = normalized.length - inScope.length;
  ```
  Resten av flödet (`exportable`, `expandModes`, …) körs på `inScope` istället för `normalized`. `withRx` räknas från `inScope.filter(...)` så uW QTH inte längre dyker upp i "Saknar RX-frekvens".
- Utöka `PipelineResult` med `outOfScope: number` och returnera den.

Matchningen sker case-sensitive på exakt strängen `"uW QTH"`. Om fler liknande kategorier dyker upp senare läggs de till i `OUT_OF_SCOPE_TYPES`.

### 2. `src/components/codeplug/RepeaterFilterPanel.tsx`

```ts
const allTypes = Object.keys(summary.uniqueCounts.type)
  .filter((t) => !OUT_OF_SCOPE_TYPES.has(t));
```
Då försvinner "uW QTH" som alternativ i Typ-multiselectet. Om användaren har en gammal sparad inställning med "uW QTH" i `filter.types` är det harmlöst — de raderna är redan borttagna innan filter körs.

### 3. `src/routes/index.tsx` — tooltip-uppdatering

I beräkningen som bygger tooltipen för "Bortfiltrerade":

- Lägg till `outOfScope = pipeline?.outOfScope ?? 0`.
- Justera `droppedByFilter`-uträkningen så `outOfScope` inte hamnar i "Bortfiltrerade av filter":
  ```ts
  const droppedByFilter = Math.max(
    0,
    droppedOut - missingRx - droppedByDedupe - manuallyExcluded - outOfScope,
  );
  ```
- Lägg in raden `• uW QTH: N` (när > 0) i tooltipens lista, t.ex. överst bland orsakerna.

### 4. Test (`src/lib/codeplug/__tests__/pipeline.test.ts`)

Lägg till ett kort test som matar in en `uW QTH`-rad och en vanlig FM-repeaterrad och verifierar att:
- `outOfScope === 1`
- den uW QTH-raden inte räknas i `withRx` och inte finns kvar i `channels`.

## Filer som ändras

- `src/lib/codeplug/pipeline.ts` — `OUT_OF_SCOPE_TYPES`, tidig filtrering, ny räknare.
- `src/components/codeplug/RepeaterFilterPanel.tsx` — döljer uW QTH i Typ-filtret.
- `src/routes/index.tsx` — visar "uW QTH" i tooltipen.
- `src/lib/codeplug/__tests__/pipeline.test.ts` — ett nytt test.
