# sk6ba → chirp.csv

Ett webbverktyg som omvandlar Marks Amatörradioklubbs / SK6BA:s repeaterexport (CSV) till en CHIRP-importerbar CSV. All bearbetning sker lokalt i webbläsaren — ingen data laddas upp någonstans.

## Vad verktyget gör

- Läser SK6BA/Marks repeater-CSV (semikolon-separerad, komma eller punkt som decimal, UTF-8 med eller utan BOM).
- Visar datainspektion: antal rader, kolumner, unika värden för type/status/mode/band/district/network, samt räknare för rader med saknad output, koordinater, oklar tx_shift och ej tolkbar CTCSS.
- Filtrerar interaktivt på status, type, mode, band och distrikt.
- Bygger kanalnamn från valbara komponenter (`{type} {network} {band} {district} {city} {channel} {call}`), med separator, maxlängd, separat maxlängd för ort, translitterering av svenska tecken, versaler, och redigerbara förkortningar.
- Tolkar `tx_shift` till CHIRP `Duplex`/`Offset`.
- Tolkar `access` och extraherar CTCSS; behandlar 1750 som tonburst, inte CTCSS.
- Sorterar med valbar kombination av distrikt, geohash, type, ort och frekvens.
- Hanterar namnkollisioner deterministiskt (numeriskt suffix, bokstavssuffix eller stopp).
- Visar preview med både fullt och klippt namn, kollisionsmarkering, varningar.
- Exporterar standard-CHIRP-CSV med alla vanliga kolumner.

## Vad det INTE gör (v1)

Ingen radiospecifik export (RT-95, Radtel, Nicsure, etc). Ingen DMR/D-Star/C4FM/BrandMeister-konfiguration. Inga radioprofiler. Digitala moder konfigureras inte; en rad med `FM / DMR` tas dock med som analog FM-kanal om du valt "mode innehåller FM".

## Defaults

- Status: `QRV`
- Type: `Repeater`, `Link`, `Hotspot`
- Mode-strategi: innehåller FM
- Band: 2m och 70cm (om de finns i exporten)
- Distrikt: alla svenska
- Kanalnamn: `{city}`, max 6 tecken (passar de flesta analoga handapparater)
- CHIRP Mode: NFM
- Sortering: distrikt → geohash → ort

## CTCSS- och 1750-regler

- `1750` betraktas alltid som tonburst, aldrig som CTCSS.
- Numeriska värden i intervallet 40–300 Hz tolkas som CTCSS.
- Om flera CTCSS-värden finns väljs den sista (`1750 / 77.0` → CTCSS 77.0).
- Rå `access` bevaras alltid i kanalens Comment.
- Default `Tone` (ej `TSQL`); `cToneFreq` default 88.5.

## Frekvens- och shift-regler

- `Frequency` = `output` från SK6BA (repeaterns utfrekvens = radions RX).
- Negativ `tx_shift` → `Duplex = -`, `Offset = abs(shift)`.
- Positiv → `Duplex = +`.
- `0`, tomt eller `simplex` → tom Duplex, Offset `0.000000`.
- Oklart värde → raden får varning och exporteras med tom Duplex; den dyker upp markerad i preview så du kan se den.

## Kollisionspolicy

Efter klippning till maxlängd kontrolleras dubbletter. Default lägger till numeriskt suffix (`KUNGSB`, `KUNGS1`, `KUNGS2`), med basnamnet trunkerat så slutresultatet ryms inom maxlängden. Du kan välja bokstavssuffix (`KUNGSA`, `KUNGSB`) eller stoppa export vid kollision.

## CHIRP-importflöde

1. Exportera filen från verktyget.
2. Öppna CHIRP.
3. File → Open din radioimage (eller ny image för rätt modell).
4. File → Import → välj `chirp.csv`.
5. Granska och spara/upload till radion.

CHIRP-CSV är generisk — `Mode = NFM` passar de flesta moderna 2m/70cm-radior. Byt till FM om din radio kräver det.

## Felsökning

- **CSV laddas inte:** kontrollera att filen är SK6BA/Marks export. Verktyget förväntar sig kolumner som `type`, `band`, `mode`, `output`, `tx_shift`, `access`, `status`, `lat`, `lng`.
- **Tomma namn:** lägg till fler komponenter (t.ex. `{call}`) eller höj maxlängd.
- **För många bortfiltrerade rader:** kontrollera filter-kryssen och mode-strategin.
- **URL-import fungerar inte:** servern kan blockera CORS. Ladda ner CSV och välj fil istället.
