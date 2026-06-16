## Mål

I VGC-fallet ska channel-packs alltid delas upp i filer om ≤ `limits.maxChannelsPerGroup` (32) — oavsett vilket split-läge användaren valt (`single`, `per_district`, `per_district_chunked`). Districts/repeaters ska däremot fortsätta följa användarens val.

## Varför

Channel-packs har inget distrikt och bucketas till `packs`. Idag chunkas de bara om hela exporten är i `per_district_chunked`. Eftersom N76 hårdvarumässigt är begränsad till 32 kanaler per grupp blir en `_packs.csv` med 80 rader oanvändbar i appen.

## Ändringar

### 1. `src/lib/codeplug/targets/split.ts`

Lägg till en valfri `packsChunkSize?: number` på `buildSplitFiles`-options. Regler vid bygg av filer från `packs`-bucketen:

- `single`-läge: oförändrat — packs läggs i en fil (om vi splittar packs här bryter vi förväntningen att `single` ger exakt en fil). Se sektion "Frågetecken" nedan.
- `per_district`: om `packsChunkSize` är satt, chunka packs med det värdet. Districts chunkas inte.
- `per_district_chunked`: chunka packs med `min(split.chunkSize, packsChunkSize ?? Infinity)`. Districts chunkas med `split.chunkSize` som idag.

Implementation: behåll en `chunkSize`-beräkning per bucket istället för en gemensam.

### 2. `src/lib/codeplug/targets/vgc-n76.ts`

I `exportMany`, skicka `packsChunkSize: VGC_N76_LIMITS.maxChannelsPerGroup` (= 32) till `buildSplitFiles`.

### 3. `src/lib/codeplug/targets/chirp-generic.ts`

Oförändrad — skickar ingen `packsChunkSize` (CHIRP har ingen gruppgräns).

### 4. Tester — `src/lib/codeplug/__tests__/targets/split.test.ts`

Nya fall:

- VGC `per_district` med 50 paketrader → en `_distrikt_X.csv` per distrikt + `_packs_part1.csv` (32 rader) + `_packs_part2.csv` (18 rader).
- VGC `per_district_chunked` med `chunkSize: 50` och 80 paketrader → `_packs_part1..3.csv` med 32/32/16 (min-regeln slår in).
- VGC `per_district_chunked` med `chunkSize: 10` och 25 paketrader → `_packs_part1..3.csv` med 10/10/5 (user-värdet vinner).
- CHIRP `per_district` med 100 paketrader → fortfarande en enda `_packs.csv` (ingen `packsChunkSize`).

## Filnamn

Inga nya regler — befintlig `chunkFilename` ger `vgc-n76_packs_part1.csv` osv. när `totalChunks > 1`.

## Frågetecken / icke-mål

- **`single`-läget chunkar inte packs.** Det är det principielt minst förvånande: användaren har sagt "en fil". Vill du istället att VGC i `single`-läget alltid emittierar separata pack-filer (vilket gör att läget bryter sitt eget namn) — säg till så lägger jag in det.
- UI-ändringar — ingen. Användaren ser bara fler filer i ZIP:en när det behövs.
- Per-distrikt-gruppgränsen (max 32/distrikt på N76) hanteras separat i `per_district_chunked` om användaren sätter `chunkSize: 32`; ingen automatisk capping av distrikten i den här ändringen.
