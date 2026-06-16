
## Mål

Skriv om `README.md` så den är koncis och speglar appens nuvarande funktionalitet. Den nuvarande versionen är från v1 och beskriver bara CHIRP-export och ett enda kanalpaket — verkligheten är nu:

- Pluggbara exportmål (CHIRP-generisk + VGC N76, lätt att lägga till fler)
- 9 kanalpaket (amatör 2m/70cm + RX-only: marin VHF, PMR446, airband, jakt 155 MHz, SRBR 444, 69 MHz, CB27)
- Splittning av export (single / chunked per pack / per band)
- Per-rad-exkludering i preview
- Sparade exporter (localStorage)
- QTH (Maidenhead) + hemdistrikt för avståndssortering
- Allt material i README:n om "v1 begränsningar", "framtida kanalpaket-feature" osv. är inaktuellt.

## Ny struktur (koncis, ~150 rader istället för ~130 utspridda)

1. **Rubrik + en mening** — vad det är, att det körs lokalt i webbläsaren.
2. **Funktioner** — punktlista, en rad per feature, grupperad:
   - Datakällor: SK6BA/Marks-CSV + kanalpaket
   - Exportmål: CHIRP-generisk, VGC N76 (pluggbar arkitektur)
   - Bearbetning: namngivning, sortering, kollisioner, dubbletter
   - UX: preview med exkludering, sparade exporter, varningar
3. **Kom igång** — 4 steg: hämta CSV (länk till SK6BA-kartan), öppna appen, välj paket, exportera.
4. **Datakällor** — kort beskrivning av SK6BA-importen och kanalpakten med tabell över paketen.
5. **Exportmål** — kort om CHIRP-generisk vs VGC N76, och splittning.
6. **Namngivning, sortering, kollisioner, CTCSS/shift, dubbletter** — komprimerade regler, inte fullt så ordrika som idag. En kort sektion var.
7. **Lägga till nytt kanalpaket** — kvar (relevant för bidrag).
8. **Utveckling** — `bun install`, `bun run dev`, `bun test`. Tech stack på en rad.
9. **Licens** — MIT + länk.
10. **Felsökning** — kvar men minimal (3–4 punkter).

## Det jag tar bort / städar

- "Vad det INTE gör (v1)" — inaktuell, ersätts med att VGC N76 nämns och att DMR/D-Star/digitala moder fortfarande inte konfigureras (en rad i functions-listan).
- "Varför bara 2m/70cm amatör i v1?" — irrelevant nu.
- Långa CSV-kolumnlistan för kanalpaket — flyttar till "Lägga till nytt kanalpaket"-sektionen, lite kortare.
- Dubbletter mellan "Kanalpaket"-sektion och toppen.
- Felaktig sökväg `src/lib/chirp/channel_packs/registry.ts` → uppdateras till `src/lib/codeplug/channel_packs/registry.ts`.

## Det jag behåller med samma sak men kortare

- CTCSS/1750-regler (en 4-radig blurb)
- Frekvens/shift-regler (en 4-radig blurb)
- Kollisionspolicy (en mening + exempel)
- CHIRP-importflödet (numrerade steg)

## Saknar jag något?

Om du vill att jag inkluderar något av nedan, säg till — annars hoppar jag dem:

1. Screenshots / GIF
2. Badges (build, license, deploy)
3. Avsnitt om bidragsrutin (PR-process, code style)
4. Roadmap / known limitations utöver felsökningsavsnittet

Den uppdaterade README:n committas till repot och syncar via GitHub-integrationen.
