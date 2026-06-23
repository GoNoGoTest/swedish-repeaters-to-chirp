# Plan: flerords-mode-alias i `parseModes`

## Mål

Göra `MODE_ALIASES`-tabellen ärlig: poster med mellanslag (idag `"SYSTEM FUSION"`, `"D STAR"`) ska faktiskt matcha som hela fraser, inte bli död kod efter whitespace-split.

## Ändringar

### 1. `src/lib/codeplug/modes.ts`

Inför ett fras-steg före whitespace-split i `parseModes`:

1. Splittra på separatorerna `/`, `,`, `;`, `|` (oförändrat) → ger "chunks".
2. **Nytt:** för varje chunk, normalisera whitespace (`\s+` → ett mellanslag) och försök matcha hela chunken mot `MODE_ALIASES` (upper-case). Träff → push canonical, hoppa över token-loopen för chunken.
3. Annars: nuvarande beteende — splittra chunken på `\s+` och slå upp varje token.

Bygg en härledd `PHRASE_ALIASES`-map (eller iterera bara `MODE_ALIASES`-nycklar som innehåller mellanslag) så att tabellen förblir single source of truth — inga dubbletter att hålla i synk.

Lägg en kort kommentar vid `MODE_ALIASES` som förklarar att nycklar med mellanslag behandlas som fraser och måste förekomma som en sammanhängande chunk (mellan separatorer) i indata.

### 2. `src/lib/codeplug/__tests__/modes.test.ts`

Lägg till tester som låser beteendet:

- `parseModes("System Fusion")` → `["C4FM"]` (frasträff, case-insensitive).
- `parseModes("SYSTEM   FUSION")` → `["C4FM"]` (multipla mellanslag inom frasen).
- `parseModes("FM / System Fusion / DMR")` → `["FM", "C4FM", "DMR"]` (frasen som en chunk mellan `/`).
- `parseModes("D Star")` → `["D-Star"]` (täcker existerande `"D STAR"`-aliaset).
- `parseModes("Fusion")` → `["C4FM"]` (single-token-grenen oförändrad).
- `parseModes("System / Fusion")` → `["C4FM"]` (separator bryter frasen → bara `Fusion` matchar; `System` droppas tyst).
- `parseModes("frobnicate widget")` → `[]` (okänd fras → faller till tokens → båda droppas).

Existerande tester ska fortsätta passera oförändrade.

## Utanför scope

- Ingen ändring i `MODE_ALIASES`-innehåll utöver eventuell kommentar.
- Inga ändringar i pipeline, exporters eller UI — parsern är enda ytan som rörs.
- Ingen normalisering av bindestreck/punkt (t.ex. "D.Star") — separat diskussion om det dyker upp.

## Verifiering

`bun run verify`.
