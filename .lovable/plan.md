# Plan: synka kommentarer och UI-text med implementationen

## Mål

Eliminera de glidningar du pekade på, utan att ändra beteende. Tre konkreta strängar/kommentarer är felaktiga idag.

## Ändringar

### 1. VGC-panelens hjälptext (`src/components/codeplug/ExportPanel.tsx:145`)

Idag: `"N76 grupperar i klumpar om 32. Överskrids gränsen visas en varning — uppdelning sker manuellt i v1."`

Nytt: tydliggör att split-panelen nedan kan göra uppdelningen automatiskt via `per_district_chunked`, och att varningen bara gäller om man behåller `single`.

Förslag: `"N76 grupperar i klumpar om 32. Vid 'En enda fil' visas bara en varning om gränsen överskrids — välj 'Per distrikt + chunka' nedan för att dela upp filen automatiskt."`

### 2. VGC validate-varning (`src/lib/codeplug/targets/vgc-n76.ts:309`)

Idag: `"… — dela manuellt i flera filer/grupper."`

Nytt: peka på split-läget istället för "manuellt".

Förslag: `"${n} kanaler överstiger N76:s ${cap}/grupp — välj split-läget 'Per distrikt + chunka' i exportpanelen, eller dela upp manuellt innan import."`

### 3. Split-panelens beskrivningar (`src/components/codeplug/ExportPanel.tsx:343-355`)

Idag säger texterna "distriktssiffra", men `groupChannelsForSplit` bucketar på `region` (country + districtLabel) — SE/SM6, NO/LA, DK/OZ, FI/OH6, etc.

Förslag:

- `per_district` label oförändrad (`"En fil per distrikt"`), beskrivning →
  `"Repeatrar grupperas per region (SM0–SM7, LA, OZ, OH0–OH9, …). Kanalpaket hamnar i egna filer."`
- `per_district_chunked` beskrivning →
  `` `Som ovan men varje fil delas vidare när den når kanaltaket${groupCap ? ` (default ${groupCap})` : ""}.` `` (oförändrad — den beskriver bara chunkning).

Övervägd men avstådd: byta select-värden från `per_district` → `per_region`. Det kräver migration av persisterad `SplitSettings.mode` och berör typer/registry. Utanför scope.

## Utanför scope

- Ingen funktionalitetsändring i `vgc-n76` eller `split`.
- Ingen omdöpning av `SplitMode`-värden.
- Inga övriga UI-strängar revideras i denna pass (om du vill ha en bredare språkgenomgång, säg till så öppnar jag det separat).

## Verifiering

`bun run verify`. Inga nya tester behövs — det här är ren textsync.
