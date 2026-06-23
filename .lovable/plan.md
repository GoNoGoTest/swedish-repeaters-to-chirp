## Mål
Namnkollisioner ska inte räknas som "Varningar" – varken i stat-rutan, i preview-tabellens varningsikon (⚠ !N) eller i radens röda markering. De ska bara synas under stat-rutan "Namnkollisioner".

## Ändringar

### 1. `src/routes/index.tsx` – stat-räkning och filter
- `stats.warned`: räkna bara varningar vars kod **inte** är `name_collision`.
  ```ts
  const realWarnings = c.warnings.filter((w) => w.code !== "name_collision");
  if (realWarnings.length) warned++;
  ```
- Stat-filter `"warned"` i `previewChannels`: matcha `c.warnings.some((w) => w.code !== "name_collision")` istället för `c.warnings.length > 0`.
- Tooltip för "Varningar" justeras: ta bort intrycket att namnkollisioner ingår (de har egen ruta).

### 2. `src/components/codeplug/PreviewTable.tsx` – visuell varningssignal
- Beräkna `realWarnings = c.warnings.filter((w) => w.code !== "name_collision")` per rad.
- `baseRowClass`: `realWarnings.length ? "bg-destructive/5" : isPack ? "bg-primary/5" : ""`.
- ⚠-kolumnen: visa `!N` baserat på `realWarnings` (title-text och count). Om kanalen bara har en `name_collision`-varning blir kolumnen tom – kollisionen syns redan via det gulmarkerade namnet (`c.collided`).

### 3. Ingen ändring i pipeline/data
`name_collision` finns kvar i `c.warnings` (används bl.a. i target-validators). Vi filtrerar enbart i UI.

### 4. Tester
Inga befintliga tester verifierar UI-räkningen. Lägger inte till nya tester – ändringen är ren presentation. Befintliga 261 tester ska fortsatt passera.

## Tekniska detaljer
- `name_collision` pushas i `pipeline.ts` när `ch.collided === true`, så `collided`-räkningen och kollisionsvarningen är redundanta. Vi behåller båda men låter UI:t behandla dem som "kollisioner", inte "varningar".
