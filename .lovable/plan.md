
# CHIRP CSV Generator — webbapp för SK6BA/Marks repeaterexport

Ett verktyg i webbläsaren som tar Marks Amatörradioklubbs CSV-export och producerar en ren, importerbar CHIRP-CSV. All bearbetning sker lokalt i webbläsaren — ingen server, inga uploads någonstans.

## Användarflöde

1. **Ladda in data** — släpp fil eller klistra in URL till SK6BA-CSV. Verktyget visar direkt en datainspektion: antal rader, kolumner, unika värden för type/status/mode/band/district/network, och räknare för saknade fält (output, koordinater, oklar tx_shift, ej tolkbar CTCSS).
2. **Välj läge** — Snabbt (vettiga defaults, en knapp till preview) eller Avancerat (alla inställningar exponerade).
3. **Filter** — kryssrutor för status (default QRV), type (default Repeater + Link + Hotspot), mode-strategi (default "innehåller FM"), band (default 2m + 70cm om de finns), distrikt (default alla svenska).
4. **Namngenerator** — drag-and-drop / chip-baserad mall för komponenter `{type} {network} {band} {district} {city} {channel} {call}`, separator, maxlängd, separat maxlängd för ort, translitterering på/av, case, förkortningar (redigerbar tabell med defaults), kollisionspolicy (numeriskt suffix / sista-tecken-suffix / stopp).
5. **CHIRP-inställningar** — startnummer för Location (default 1), Mode (NFM/FM, default NFM), Skip-policy per type, TStep.
6. **Sortering** — välj fält och ordning: distrikt, geohash, type, ort, frekvens. Geohash av/på.
7. **Preview** — tabell med alla rader: source row, type, network, band, district, city, call, channel, frequency, tx_shift, access, tolkad CTCSS, namn före klippning, slutligt namn, Duplex, Offset, Mode, Skip, Comment, warnings. Kollisioner och varningar markeras tydligt. Sammanfattning högst upp (antal in/ut/filtrerade/varnade/kolliderade).
8. **Export** — knapp som laddar ner CHIRP-CSV. Separat knapp för varningsrapport (CSV/text).

## Kärnlogik (separerad från UI)

Återanvändbara TypeScript-moduler under `src/lib/chirp/`. Ingen UI-import i kärnan; allt rent funktionellt så det är enhetstestbart och senare kan portas/återanvändas.

```text
src/lib/chirp/
  importers/sk6ba.ts      // robust CSV-parse: ;-separator, , eller . decimal, UTF-8/BOM, kolumnmappning
  models.ts               // NormalizedChannel-typ + warnings-enum
  filters.ts              // status/type/mode/band/district-filter
  tones.ts                // parse access: 1750, CTCSS-extraktion, val-regel
  frequency.ts            // tx_shift -> Duplex/Offset, simplex-detektering
  naming.ts               // tokens, förkortningar, translitterering, klippning, kollisionsupplösning
  sorting.ts              // multi-key sort inkl. geohash från lat/lng
  geohash.ts              // standard geohash-encoding
  exporters/chirp.ts      // skriv CHIRP-CSV med exakta kolumner
  validation.ts           // samla warnings, generera rapport
  pipeline.ts             // orchestrerar: import -> normalize -> filter -> name -> sort -> export
```

**Tone-regel:** ignorera 1750 som tonburst, plocka numeriska värden i 40–300 Hz som CTCSS, välj den som inte är 1750; om flera CTCSS finns välj sista. Bevara alltid rå `access` i Comment. Default `cToneFreq=88.5`, ingen TSQL om inte användaren ber om det.

**Frequency-regel:** Frequency = output (RX). tx_shift<0 → `-`/abs; >0 → `+`/value; 0/tomt/"simplex" → tom Duplex, Offset 0.000000; oklar → varning, exporteras inte tyst som simplex.

**Comment-format:** `<call> | <channel> | <city> | D<district> | <type> | <network> | access=<raw> | loc=<locator>` — tomma delar utelämnas.

**Kanalnamn:** tokens slås ihop med separator, translitterering Å/Ä→A, Ö→O m.fl., uppercase default, klipps till maxlängd; kollisionspolicy körs deterministiskt efter klippning, både `generated_name_full` och `generated_name_final` visas i preview.

## UI

- TanStack Start single-page route (`/`). Inga andra sidor i v1.
- Stegindelat wizard-mönster med sticky sammanfattning i sidopanel.
- Filparser körs i webbläsaren med Papa Parse (`bun add papaparse`).
- Preview-tabell renderas virtualiserat (TanStack Virtual om listan är stor).
- Inställningar persisteras i `localStorage` så att användaren får tillbaka sina förkortningar/mall nästa gång.
- Design: ren, teknisk, mörk default. Mono-font för tabell-/frekvenskolumner. Tydliga warning-badges.

## Vad som INTE byggs i v1

Ingen Nicsure/Radtel/RT-880-specifik export. Ingen DMR/D-Star/C4FM/Brandmeister-konfiguration. Inga radioprofiler. Ingen backend. Ingen multi-fil-export per körning.

Arkitekturen tillåter senare tillägg: nya exporters under `exporters/`, ny mode-hantering i `models.ts`, utan att röra resten.

## Tester

Vitest-tester för `tones`, `frequency`, `naming` (inkl. kollisioner och svenska tecken), `filters`, `geohash`, `pipeline` end-to-end med ett litet fixture av ~20 rader som täcker: vanlig 2m-repeater, 70cm, simplex/hotspot, link, beacon (filtreras), access "1750", "1750 / 77.0", komma-decimal, mixed FM/DMR, digital-only, saknad output, oklar shift, saknade koordinater, kollisionsorter, svenska tecken, tomt city.

## Leverabler

- Fungerande webbapp på preview-URL:en.
- README med syfte/icke-syfte, defaults, ton/1750-regler, namngivning, kollisionspolicy, CHIRP-importflöde, felsökning.
- Testsvit som täcker fallen ovan.

## Frågor innan jag bygger

Inga blockerande — specen är detaljerad. Jag använder webbapp-spåret (det du valde) med TypeScript-kärna istället för Python, eftersom projektet är en TanStack Start-app. Säg till om du hellre vill ha en Python-CLI parallellt så lägger jag den i `tools/` (men det dubblar kärnlogiken).
