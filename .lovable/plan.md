## Två justeringar i namngivnings-UI

### 1. Ta bort "Max längd ort" från kanalpaket
Fältet `cityMaxLength` är meningslöst för paketrader (de har sällan en ort). I `NamingEditor` (`src/routes/index.tsx` rad ~499) lägg till en prop `showCityMaxLength` som default är `true`. Dölj `NumberField` på rad 533 när den är `false`. Vid anropet i `PackRow` (rad 662) sätt `showCityMaxLength={false}`. Repeater-anropet (rad 203) är oförändrat.

Bakomliggande `naming.cityMaxLength` i pack-settings rörs inte (default 6 i `DEFAULT_PACK_NAMING`, påverkar bara `{city}`-token som paket nästan aldrig använder).

### 2. Mini-preview per kanalpaket baserad på paketets egna rader
Idag använder `NamingPreview` hårdkodade `PACK_EXAMPLES` — samma exempel för alla paket. Ändra så att packsens preview visar 2–3 riktiga rader från det aktuella paketet.

- Lägg till en valfri `sampleChannels?: NormalizedChannel[]`-prop på både `NamingEditor` och `NamingPreview`.
- I `NamingPreview`: om `sampleChannels` finns, mappa över de första 3 (välj gärna första, mitten, sista för spridning) och kör `buildName(ch, naming)` direkt. Label = `service` + ` ` + (`name_hint` || `channel` || `label`), trunkerad.
- I `PackRow`: skicka `sampleChannels={pack.channels.slice(0, 3)}` (eller jämnt fördelade index om `pack.channels.length > 3`) till `NamingEditor`.
- Behåll `PACK_EXAMPLES`-fallback om `sampleChannels` saknas eller är tom.

Repeater-previewen fortsätter använda `REPEATER_EXAMPLES` oförändrat.

### Filer
- `src/routes/index.tsx` — enda filen som ändras.

### Verifiering
- Öppna ett paket (t.ex. PMR446), kolla att previewen visar paketets egna kanalnamn (PMR1, PMR2…) istället för generiska exempel.
- Bekräfta att "Max längd ort"-fältet är borta i pack-editorn men finns kvar för repeatrar.
- `bunx vitest run` (inga logik-ändringar förväntas, bara UI).
