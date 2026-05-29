# Repeater-dubbletter + UX-förbättringar för förhandsvisning

Tre fristående ändringar mot dagens beteende.

## 1. Sluta varna för sk6ba-vs-sk6ba frekvensdubbletter

I `src/lib/chirp/dedupe.ts`: varna bara när minst en pack-rad krockar med en sk6ba-rad (eller pack-vs-pack). Två SK6BA-rader på samma frekvens är normalt på amatörbanden och ska inte färgas röda.

- Behåll dropp-policys (`drop_pack`/`drop_sk6ba`) som idag, men `freq_duplicate`-warningen läggs bara på rader i grupper där `hasSk6ba && hasPack` (eller `packCount >= 2`).
- Uppdatera `dedupe.test.ts`: ny test "sk6ba-vs-sk6ba does not warn", befintliga pack-vs-sk6ba-tester står kvar.
- Antalsindikatorn på toppen (rad 124 i `index.tsx`, "X dubbletter") räknar fortfarande `freq_duplicate`-warnings → blir korrekt automatiskt.

## 2. Split-vy: inställningar vänster, kanal-lista höger på breda skärmar

I `src/routes/index.tsx`, `<main>` (rad 162):

- På `xl:` och uppåt (≥1280px): tvåkolumnsgrid, `xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`, gap 6.
- Vänsterkolumn: alla `<Section>`-block (Källor, Filter, Namngivning, Toner, …, CHIRP-export).
- Högerkolumn: Förhandsvisning + nedladdningsknapp i en `sticky top-4` container med `max-h-[calc(100vh-2rem)] overflow-auto`.
- Bredda `max-w-7xl` → `max-w-[1600px]` så det får plats.
- Under `xl` (inkl. mobil 430px som nu): oförändrat stackad layout.

Förhandsvisningstabellen får `text-xs` redan idag; inga ändringar i kolumner krävs.

## 3. Mini-namnförhandsvisning i namngivnings-sektionen

I namngivnings-sektionen (runt rad 562 i `index.tsx`):

- Lägg till en liten preview-rad under komponentvalen: visa 3 exempelnamn (en SK6BA-repeater, en pack-rad, en lång ortnamns-edge case) byggda via `buildName()` med aktuella inställningar.
- Render som monospace-chips: `font-mono text-xs px-2 py-1 rounded bg-muted` i en `flex gap-2 flex-wrap`.
- Exempel-input hårdkodas i en `EXAMPLES`-konstant i samma fil (city/call/channel/district/band) → ingen ny modul behövs.
- Uppdateras automatiskt via `useMemo` på samma settings som driver pipelinen.

Övriga sektioner (toner, packs, sortering) får ingen mini-preview — namnbygget är det enda där "hur ser ett namn ut" är otydligt utan att scrolla.

## Verifiering

- `bunx vitest run` — dedupe-test grön, sorting/naming opåverkade.
- Manuell check i preview vid 1440px-bredd: split-layout, sticky preview scrollar med.
- Mobile 430px: ingen regression, allt stackat som förut.
- Ladda SK6BA-CSV: två repeatrar på 145.7250 ska INTE längre vara röda.
