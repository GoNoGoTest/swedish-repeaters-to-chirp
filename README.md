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

## Kanalpaket

Utöver SK6BA-importen kan verktyget lägga till **kanalpaket** — fasta, kanaliserade frekvenslistor som inte är repeatrar. I första versionen följer ett enda datapaket med: svenska amatörradio-kanaler för 2 m och 70 cm (simplex V17–V45 och U272–U286, APRS 144.800 och 432.500, FM-anrop V40/145.500 och U280/433.500, aktivitetscentra för CW/SSB/SSTV/data, packet/WinLink, DV-internet-gateway m.fl.).

Repeaterdata kommer fortfarande från SK6BA/Marks-importen. Kanalpaket är en parallell källa och blandas inte ihop med repeaterlogiken.

### CSV-format

Kanalpaket läses från CSV-filer i `channelpacks/`. Formatet är generellt och avsett att klara även framtida icke-amatör-paket (marin VHF, PMR446, airband, jaktradio, CB osv.) — utan att kärnlogiken behöver ändras. Alla kolumner:

`pack_id, source_id, enabled_default, service, band, category, tags, type, label, channel, name_hint, rx_frequency, tx_frequency, duplex, offset, mode, tstep, tone, rtone_freq, ctone_freq, dtcs_code, dtcs_polarity, skip, tx_allowed, rx_only, license_note, comment, source, source_url, inferred_from_range`

- `enabled_default=true` markerar de rader som föreslås som default när användaren slår på kanalpaket. I amatörpaketet är detta i praktiken simplex, APRS och anropskanaler.
- `category` är primär kategori (`simplex`, `aprs`, `calling`, `packet`, `weak_signal_activity`, `internet_voice_gateway`, `dv_internet_gateway`, …) och `tags` är en pipe-separerad lista som tillåter flera klassificeringar per rad.
- `tx_allowed=false` eller `rx_only=true` betyder att raden inte ska exporteras tyst som en sändbar simplexkanal. Användaren väljer policy: varna+markera i Comment (default), exportera som `Duplex=off`, hoppa över, eller stoppa export.
- `inferred_from_range=true` betyder att raden är genererad från ett kanalintervall i bandplanen snarare än uttryckligen listad. Sådana rader markeras med `INF` i preview.
- `source` och `source_url` beskriver bandplansdokumentet.

### Lägga till ett nytt kanalpaket

1. Lägg en CSV-fil i `channelpacks/` med samma kolumnstruktur.
2. Registrera filen i `src/lib/chirp/channel_packs/registry.ts` (Vite läser den som `?raw` vid build).
3. Klart — paketet dyker upp i UI:t. Ingen ändring av pipeline, namngenerator eller export krävs.

### Interaktivt flöde

Steg 4 i appen är "Kanalpaket". Default är **Nej**. Övriga val:
- **I början** — kanalpaketskanaler får de första `Location`-numren, sedan SK6BA.
- **I slutet** — SK6BA först, kanalpaketskanaler efter.
- **Samma sortering** — allt slås ihop och sorteras med samma nycklar. Geohash-sortering hanterar att kanalpaketsrader saknar koordinater.

Per paket går det att:
- klicka "Använd default" för att välja alla rader med `enabled_default=true`,
- filtrera på band (2m/70cm), kategori (simplex/aprs/calling/…), och tag.

`Location`-numren tilldelas alltid sist, efter att slutlig kanalordning är bestämd.

### Namngivning

Namngeneratorn har utökats med tokens som passar kanalpaket: `{service}`, `{category}`, `{label}`, `{channel}`, `{name_hint}`. Tomma komponenter droppas automatiskt — inga ledande, dubbla eller efterföljande separatorer även om en kanalpaketsrad saknar city/call. Om en kanalpaketsrad ändå skulle få tomt namn med den valda mallen faller den tillbaka på `name_hint` → `channel` → `label` → `category`.

Exempel på mallar:
- `{name_hint}` → `V40`, `APRS`
- `{band}-{channel}` → `2M-V40`, `70-U280`
- `{category}-{channel}` → `SIMPLEX-V40`

### Kollisioner och frekvensdubbletter

Kanalpaketsrader ingår i samma namnkollisionshantering som SK6BA-kanaler. Frekvensdubbletter mellan SK6BA och kanalpaket (och kanalpaket sinsemellan) markeras alltid i preview. Policy för dubbletter:
- **Behåll båda** (default — användbart när källtyp eller kategori skiljer sig)
- Hoppa över kanalpaketsraden
- Hoppa över SK6BA-raden
- Stoppa export

### CHIRP-export

Kanalpaketsrader exporteras till samma CHIRP-CSV som repeaters. Simplex exporteras med tom `Duplex` och `Offset=0.000000`. Split-kanaler exporteras med `Duplex=split` och `Offset=tx_frequency`. RX-only-rader hanteras enligt vald policy. `license_note` läggs till i `Comment` så att den följer med in i radion.

### Varför bara 2m/70cm amatör i v1?

Arkitekturen är generell — `service`, `tx_allowed`, `rx_only` och `license_note` finns redan i modellen. Men frekvensdata för marin VHF, PMR446, airband, jaktradio osv. ingår inte i v1 eftersom de tjänsterna har egna regelverk för sändning och inte alltid hör hemma i en amatörradio-codeplug. När sådana paket läggs till behöver bara en ny CSV droppas i `channelpacks/` och registreras i `registry.ts` — inget annat behöver ändras.
