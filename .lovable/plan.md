# APRS-reservation på plats 32 i VGC-chunks

## Mål
Lägg till en toggle i VGC N76-panelen: **"Lägg till APRS på kanalplats 32 i varje chunk"**. När på reserveras rad 32 i varje chunk för en fast APRS-kanal, och de tänkta användarkanaler som annars hamnat på plats 32 skjuts över till nästa chunk istället för att skrivas över.

## APRS-kanalen (bekräftat)
| Fält | Värde |
|---|---|
| title | `APRS` (inget krock-suffix) |
| rx_freq / tx_freq | `144800000` |
| rx_sub / tx_sub | `0` (ingen subton) |
| bandwidth | `25000` (Wide 25 kHz) |
| rx_mod / tx_mod | `0` (FM) |
| scan | `0` (ej med i scan) |
| sign | `0` (ROGER-beep AV — olämpligt för packet) |
| power | `s.defaultPower` |
| övriga fält | VGC-standardvärden (samma defaults som tomma rader / vanliga kanaler) |

## Ändringar

### `src/lib/codeplug/targets/vgc-n76.ts`
- `VgcN76Settings`: nytt fält `reserveAprsSlot32: boolean` (default `false` i `VGC_N76_DEFAULTS`).
- Ny helper `aprsVgcRow(s: VgcN76Settings)` → fast rad enligt tabellen ovan.
- Ny helper `renderVgcChunk(chunk, s)`:
  - serialiserar upp till 31 användarkanaler,
  - lägger till `aprsVgcRow(s)` som rad 32,
  - padar resterande rader upp till `maxChannelsPerGroup` med tomma rader (oförändrat).
- `exportMany`:
  - om `reserveAprsSlot32`: använd `packsChunkSize = maxChannelsPerGroup - 1` (= 31) och `split.chunkSize = 31` för `per_district_chunked` så att 32:a inmatade kanalen i en chunk flyter över till nästa fil istället för att skrivas över.
  - använd `renderVgcChunk` istället för nuvarande chunk-rendering.
- `export` (single file): använd också `renderVgcChunk` så APRS finns med på plats 32 även i enkelfilsexport (om toggle på).
- Validering: `vgc_over_group_limit` räknar fortsatt totalt 32 rader inkl. APRS (dvs. effektivt 31 användarkanaler per chunk när toggle är på).

### `src/components/codeplug/ExportPanel.tsx`
- I `VgcN76Panel`: ny checkbox bunden till `settings.reserveAprsSlot32`, placerad i chunking-sektionen, med kort hjälptext: *"Reserverar plats 32 för APRS 144.800 FM 25 kHz. Kanaler som annars skulle hamnat på plats 32 flyttas till nästa chunk."*

### `src/lib/codeplug/__tests__/targets/vgc-n76.test.ts`
- Toggle av (default) → oförändrat beteende.
- Toggle på + `per_district_chunked` med 64 inkanaler → 3 filer; den 32:a inmatade kanalen hamnar i `part2`, APRS finns som rad 32 i varje fil med korrekta värden (scan=0, sign=0, bandwidth=25000, freq=144800000).
- Toggle på + `single` → APRS finns som rad 32 i den enda filen.

## Oförändrat
`chirp-generic`, `split.ts`, filnamn, övriga targets och UI.