# sk6ba → codeplug

Webbverktyg som bygger en importerbar codeplug-CSV från Marks Amatörradioklubbs / SK6BA:s repeaterexport och valfria färdiga kanalpaket. **All bearbetning sker lokalt i webbläsaren — inga filer laddas upp.**

Live: <https://swe-repeater-to-codeplug.lovable.app>

## Funktioner

**Datakällor**

- SK6BA/Marks repeater-CSV (semikolon, komma- eller punktdecimal, UTF-8 med/utan BOM).
- 9 medföljande kanalpaket: amatör 2 m och 70 cm + RX-only-paket för marin VHF, PMR446, airband, jakt 155 MHz, SRBR 444, 69 MHz och CB27.
- Båda källorna är oberoende och kan blandas i samma export.

**Exportmål** (pluggbar arkitektur)

- **CHIRP-generisk CSV** — fungerar för de flesta analoga 2 m/70 cm-radior via CHIRP.
- **VGC N76** — radiospecifik CSV med korrekta kolumner, namnlängd och `tx_dis` för RX-only-kanaler.

**Bearbetning**

- Mall-baserad namngivning (`{type} {network} {band} {district} {city} {channel} {call}` m.fl.), med separator, maxlängd, translitterering av åäö, versaler och redigerbara förkortningar.
- Sortering på distrikt, geohash, type, ort, frekvens — och avståndssortering från ditt eget QTH (Maidenhead-locator) eller hemdistrikt.
- Deterministisk kollisionshantering: numeriskt eller bokstavssuffix, eller stopp.
- Markering av frekvensdubbletter mellan källor med valbar policy.

**UX**

- Datainspektion med räknare för saknad output, koordinater, oklar shift och otolkbar CTCSS.
- Interaktiva filter på status, type, mode, band, **land och region** (Sverige + nordiska/utländska regioner).
- Preview över hela exporten med per-rad-exkludering, kollisionsmarkering och varningar.
- Splittning av export: en fil, eller chunkad per distrikt, per kanalpaket och per amatörband.
- Sparade exporter (localStorage) med färskhetsindikator.

**Inte med**: DMR/D-Star/C4FM/digital-konfiguration. Digitala moder konfigureras inte; en `FM/DMR`-rad tas med som analog FM om mode-strategin tillåter det.

## Nordiskt stöd

SK6BA/Marks-exporten innehåller också nordiska och utländska repeatrar. `district`-fältet tolkas så här:

| Råvärde     | Land      | Region (`{region}`) | Land (`{country}`) |
| ----------- | --------- | ------------------- | ------------------ |
| `0`–`7`     | Sverige   | `SM0`–`SM7`         | `SE`               |
| `LA`        | Norge     | `LA`                | `NO`               |
| `OZ`        | Danmark   | `OZ`                | `DK`               |
| `OH0`       | Åland     | `OH0`               | `AX`               |
| `OH1`–`OH9` | Finland   | `OH1`–`OH9`         | `FI`               |
| `TF`        | Island    | `TF`                | `IS`               |
| `JW`        | Svalbard  | `JW`                | `SJ`               |
| `JX`        | Jan Mayen | `JX`                | `SJ`               |
| `OY`        | Färöarna  | `OY`                | `FO`               |
| `OX`        | Grönland  | `OX`                | `GL`               |

- Filterpanelen har separata land- och regionväljare med snabbknapparna **Bara Sverige**, **Norden** och **Alla**.
- Naming har två nya tokens: `{region}` (SM6, LA, OH0, …) och `{country}` (SE, NO, AX, …). Befintliga `{district}` ger fortsatt `D6` för svenska distrikt men är tom för utländska prefix så `DLA`/`DOZ` aldrig dyker upp.
- Split-export döper filerna efter region: `chirp_se_sm6.csv`, `chirp_no_la.csv`, `chirp_dk_oz.csv`, `chirp_fi_oh6.csv`, `chirp_ax_oh0.csv`, `chirp_is_tf.csv`, osv. (Tidigare `distrikt_6.csv`.)
- DMR-konfiguration är fortfarande inte med — den här ändringen rör enbart land/region för analoga repeatrar.

## Kom igång

1. Hämta CSV från [SK6BA:s repeaterkarta](https://sk6ba.se/vhf/repeater/karta/) (Export → CSV).
2. Öppna appen och dra in filen.
3. Välj exportformat, justera filter och eventuella kanalpaket.
4. Granska preview och klicka **Exportera**.

För CHIRP: öppna CHIRP → öppna din radioimage → File → Import → välj den exporterade CSV:n.

## Regler i korthet

**Frekvens & shift**

- `Frequency` = `output` (repeaterns utfrekvens = radions RX).
- Negativ `tx_shift` → `Duplex = -`, positiv → `+`, tom/`0`/`simplex` → tom Duplex.
- Oklart värde markeras med varning men exporteras med tom Duplex.

**CTCSS & 1750**

- `1750` är alltid tonburst, aldrig CTCSS.
- Numeriskt värde 40–300 Hz tolkas som CTCSS; sista vinner (`1750 / 77.0` → 77.0).
- Rå `access` bevaras alltid i `Comment`.

**Kollisioner**

- Default lägger till numeriskt suffix där alla dubletter numreras (`LUND1`, `LUND2`, `LUND3`), och basnamnet trunkeras så slutresultatet ryms inom maxlängden.

**Frekvensdubbletter** mellan SK6BA och kanalpaket: behåll båda (default), hoppa över paket-raden, hoppa över SK6BA-raden, eller stoppa exporten.

**RX-only-kanaler** (från RX-only-paket eller `tx_allowed=false`): policy väljs i appen — markera i comment, exportera som `Duplex=off`, hoppa över, eller stoppa.

## Defaults

Status `QRV` · type `Repeater/Link/Hotspot` · mode innehåller FM · band 2 m + 70 cm · land `SE` (snabbknappar för Norden/Alla) · namn `{district}-{band}-{network}-{city}-{call}` max 16 tecken · sortering distrikt → geohash → ort.

## Lägga till nytt kanalpaket

1. Lägg en CSV-fil i `channelpacks/` med rätt schema (se befintliga filer som exempel). Filer i mappen plockas upp automatiskt vid build — ingen kodändring krävs.
2. Kolumner: `pack_id, source_id, enabled_default, service, band, category, tags, type, label, channel, name_hint, rx_frequency, tx_frequency, duplex, offset, mode, tstep, tone, rtone_freq, ctone_freq, dtcs_code, dtcs_polarity, skip, tx_allowed, rx_only, license_note, comment, source, source_url, inferred_from_range`.
3. `enabled_default=true` markerar rader som föreslås som default. `tx_allowed=false` / `rx_only=true` styr RX-only-policyn. `inferred_from_range=true` markerar rader genererade från ett intervall i bandplanen och syns som `INF` i preview.

Registret ligger i `src/lib/codeplug/channel_packs/registry.ts` och använder `import.meta.glob` mot `channelpacks/*.csv`.

## Utveckling

```bash
bun install
bun run dev    # http://localhost:5173
bun run test   # vitest (kör package-scriptet, inte Buns inbyggda test-runner)
```

## Verifiering

- `bun run test` — kör hela Vitest-sviten.
- `bun run verify` — kör tester och därefter en produktionsbuild (`vite build`). Motsvarar det CI gör vid varje push och PR.

CI-workflow finns i `.github/workflows/ci.yml` och kör `bun install --frozen-lockfile`, `bun run test` och `bun run build` på push till `main` och alla PR.

Stack: TanStack Start (Vite + React 19) · Tailwind v4 · shadcn/ui · TypeScript strict.

Lägga till nytt exportmål: implementera `ExportTarget` (se `src/lib/codeplug/targets/types.ts`) och registrera i `src/lib/codeplug/targets/index.ts`. Befintliga mål (`chirp-generic.ts`, `vgc-n76.ts`) är referensimplementationer.

## Felsökning

- **CSV laddas inte** — kontrollera att det är SK6BA/Marks-export med kolumner som `type`, `band`, `mode`, `output`, `tx_shift`, `access`, `status`, `lat`, `lng`.
- **Tomma namn** — lägg till fler komponenter (`{call}`) eller höj maxlängd.
- **För många bortfiltrerade rader** — kontrollera filter och mode-strategi.
- **Radion klagar på import** — välj rätt exportmål (CHIRP-generisk vs radiospecifikt) och rätt splittnings­läge.

## Licens

MIT — se [LICENSE](LICENSE).
