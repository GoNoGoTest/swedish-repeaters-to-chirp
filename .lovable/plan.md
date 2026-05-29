## Mål

Utöka CHIRP-generatorn med ett generellt kanalpakets-system. Första (och enda) data-paketet är de två CSV-filerna i `channelpacks/`. SK6BA-importflödet förblir intakt; kanalpaket är en parallell källa som mappas till samma interna modell.

## Arkitektur

Lägg till `source_type: "sk6ba" | "channel_pack"` på `NormalizedChannel` plus alla kanalpaketsfält (pack_id, service, category, tags, label, channel, name_hint, tx_frequency, tx_allowed, rx_only, license_note, source, source_url, inferred_from_range). För SK6BA-rader sätts `source_type="sk6ba"` och kanalpaketsfälten är tomma/false.

Ny katalogstruktur:

```text
src/lib/chirp/
  importers/
    sk6ba.ts            (oförändrad)
    channel_pack.ts     (NY - CSV-parse + validering + mapping)
  channel_packs/
    registry.ts         (NY - importerar de två medföljande CSV:erna via Vite ?raw)
  pipeline.ts           (UPPDATERAS - tar emot extra channel-pack-rader)
  naming.ts             (UPPDATERAS - nya tokens + smart join som droppar tomma)
  exporters/chirp.ts    (UPPDATERAS - duplex=split, duplex=off, license_note i Comment)
  dedupe.ts             (NY - frekvensdubblettpolicy)
channelpacks/           (oförändrad - CSV-källan)
```

CSV läses statiskt med Vite `?raw`-import så det fungerar i webbläsaren utan extra fetch. Filerna räknas upp explicit i `registry.ts` (en rad per CSV) — inga nya CSV-filer skapas.

## Datamodell

`NormalizedChannel` utökas med:
- `source_type`, `pack_id`, `service`, `category`, `tags: string[]`, `label`, `channel_code`, `name_hint`, `tx_frequency`, `tx_allowed`, `rx_only`, `license_note`, `source`, `source_url`, `inferred_from_range`, `pack_selected` (om användaren manuellt valt/avvalt rad).

Befintliga fält (band, mode_raw, comment, rx_frequency, duplex, offset, ctcss, lat, lng) återanvänds rakt av.

## Pipeline-flöde

`runPipeline({ sk6baRows, packChannels, settings })`:

1. Normalisera SK6BA → kanaler (som idag).
2. Applicera SK6BA-filter (oförändrat) → SK6BA-set.
3. Ta emot förvalda kanalpaketsrader (redan filtrerade i UI: paket/band/kategori/tag/enabled_default + manuella val).
4. Lös RX-only/tx_allowed-policy per kanalpaketsrad (skip / mark / duplex=off / stop).
5. Frekvensdubbletter enligt vald policy (default: behåll båda om källtyp eller kategori skiljer; annars varna).
6. Kombinera enligt placering: `prepend` | `append` | `merge_sort`.
   - prepend/append: respektive set sorteras internt med befintlig sortering, sedan konkateneras.
   - merge_sort: alla slås ihop, sorteras med befintliga nycklar; geohash hanterar saknad lat/lng som "~" (redan implementerat — verifieras).
7. Namnsätt alla med namngenerator. Smart join: tomma tokens droppar separator (`"-".join(["", "APRS"]) → "APRS"`, inte `"-APRS"`).
8. Kollisionshantering över hela mängden (oförändrad algoritm).
9. Tilldela `Location` sist, efter slutlig ordning.

## CSV-parser för kanalpaket

`parseChannelPackCsv(text, packIdFallback)`:
- Standard Papa header-parse, komma-separator.
- Validera obligatoriska kolumner; saknade kolumner → varning men fyll defaults.
- Boolean-parse accepterar `true/false/1/0/yes/no` (case-insensitive); annat → varning.
- `tags` splittas på `|` och trimmas.
- `rx_frequency` parsas som number; ogiltig → rad-varning, raden flaggas men släpps inte tyst.
- Per-rad valideringar: saknad `source_id`, dubblett `source_id` inom paketet, saknad namn-info (label+channel+name_hint alla tomma), okänt mode.

## UI-tillägg i `src/routes/index.tsx`

Nytt sektion mellan filterpanel och preview:

**"Kanalpaket"-steg:**
- Toggle: Nej / Början / Slutet / Samma sortering (default Nej).
- Vid val ≠ Nej: lista paket från registry med rad-räkning, service, band, kategorier, tags.
- Per paket:
  - "Använd default (enabled_default=true)"-knapp
  - Multi-select band (2m / 70cm / …)
  - Multi-select kategori
  - Multi-select tag
  - Sökbart rad-träd där man kan manuellt toggla enskilda rader
- Globala policyer:
  - Frekvensdubblett: behåll båda / hoppa pack / hoppa SK6BA / stoppa
  - RX-only: varna+markera / duplex=off / skip / stop (default varna+markera)
  - Split: stöds nu (`Duplex=split`, `Offset=tx_frequency`); fallback varna+skip om tx saknas

**Preview-tabell** utökas med kolumner: Källa (SK6BA/PACK), Pack, Service, Kategori, Tags, Label, RX-only-badge, license_note-tooltip, "INF" badge om `inferred_from_range`. Färgkodning per källa.

**Settings** persisteras i `localStorage` som tidigare.

## Namngivare

`buildName` ändras så att tomma resolverade tokens inte producerar dubbla/ledande/avslutande separatorer. Nya tokens läggs till i `resolveToken`:
- `{service}` → uppercase service eller abbr-map
- `{category}` → mappas via abbreviations.category (default: rakt av, uppercase)
- `{label}` → ch.label
- `{channel}` (ny mening): formellt kanalnamn för pack; för SK6BA fortsätter befintlig `channel`-token. För att inte bryta SK6BA fältet får båda systemen läsa samma `channel_code`-fält, där SK6BA mappar `r.channel` dit (rename internt — `channel` token oförändrad utåt).
- `{name_hint}`, `{type}`, `{band}` (band fanns).

Default naming-mall är fortsatt `{city}` (SK6BA-vänligt). För kanalpaketsrader utan city blir resultatet tomt → fallback till `{name_hint}` om `city` är tomt OCH raden är `channel_pack`. Detta gör att out-of-the-box-flöde ger vettiga namn (`V40`, `APRS`) utan att användaren måste mecka.

## Export

`toChirpRows` utökas:
- Simplex (duplex=""): som idag, men `Comment` får `license_note` appendat om satt.
- Split (`duplex="split"`): `Offset = tx_frequency.toFixed(6)`, exporteras som `Duplex=split`.
- RX-only-policy "duplex_off": `Duplex="off"`.
- RX-only-policy "mark": Comment-prefix `RX-ONLY |`.
- Tone-fält tas från kanalpaketets `tone/rtone_freq/ctone_freq` om satta; annars befintlig logik.

## Validering & varningar

Nya `WarningCode`:
- `pack_missing_required`, `pack_invalid_boolean`, `pack_duplicate_source_id`, `pack_invalid_frequency`, `pack_no_name_source`, `pack_unsupported_mode`, `pack_split_unsupported`, `freq_duplicate`, `rx_only_no_policy`.

Rapport-CSV (befintlig "warnings export") inkluderar nu också `source_type`, `pack_id`, `source_id`.

## Tester

Skapa `src/lib/chirp/__tests__/`:
- `channel_pack.test.ts`: parse, header-validering, boolean-edge cases, tags-split, mapping, läsning av båda medföljande CSV:erna, filter (enabled_default, band 2m/70cm, kategori simplex, tag calling, tag aprs), närvaro av V40/145.500, U280/433.500, APRS 144.800 & 432.500, V17-V45-spann, U272-U286-spann, inga bandplans-repeaters genereras (assert att inga rader har `type` som matchar repeater-mönster), inga rader täcker satellit-segment > X MHz bredd.
- `pipeline.test.ts` utökas: prepend/append/merge_sort placering, geohash utan lat/lng, namnkollision pack↔SK6BA, frekvensdubblett pack↔SK6BA, RX-only-policy.
- `naming.test.ts`: nya tokens, smart-join utan dubbla separatorer.

Lägg `vitest` om saknas; testkommando `bunx vitest run`.

## README

Nytt avsnitt "Kanalpaket" enligt kravspec — vad de är, CSV-formatet, `enabled_default`, kategori/tags, `tx_allowed`/`rx_only`-tolkning, placerings-alternativ, varför första paketet bara är 2m/70cm amatör, hur framtida paket (marin VHF, PMR446, airband, jaktradio) kan läggas till genom att enbart droppa in en ny CSV i `channelpacks/` och registrera den i `registry.ts`.

## Vad som INTE görs

- Inga nya CSV-filer i `channelpacks/`.
- Ingen runtime-katalogläsning (browser kan inte läsa fs); registry är en explicit lista.
- Ingen radiospecifik export.

## Öppen fråga

`source_id`-värdena i de medföljande CSV:erna tycks innehålla flera dubbletter inom samma pack (t.ex. flera `weak_signal_activity`-rader med liknande id-suffix) — om `pack_duplicate_source_id` ska vara hård-fail eller bara varning. Förslag: varning (inte fail), men markera i preview. Säg till om du vill ha hård-fail.