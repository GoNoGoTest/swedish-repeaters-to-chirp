## Mål

Lägg en `RegionInfo`-abstraktion ovanpå rådatans `district` så att LA, OZ, OH0–OH9, TF, JW, JX, OY, OX behandlas som kända regioner — inte "okänt distrikt". Sverige (0–7 → SM0–SM7) fortsätter fungera identiskt. Inget DMR-arbete.

## Beslut (säg till om något ska ändras)

1. **Default-filter**: Behåll `countries = ["SE"]` som default — minimal beteendeförändring för befintliga användare. UI gör det enkelt att slå på Norden via en "Norden"-snabbknapp (sätter SE/NO/DK/FI/AX/IS).
2. **`{country}`-token**: ger landskod i versaler (`SE`, `NO`, `OH`/`AX` etc.) — kort och passar i kanalnamn. Landnamn vore ofta för långt för 6–8 teckens display.
3. **`home_district`**: behålls oförändrad i denna PR (svenska digit). Ingen omdöpning till `home_region` nu — minskar risk.
4. **Callsign-inferens**: ingen ny callsign-baserad gissning för LA/OZ. Endast `district`-fältet som källa, exakt som du skrev.
5. **`includeUnknownDistricts`**: behålls som alias för `includeUnknownRegions` i migrationen (loadStoredSettings), tas inte bort.

## Arbetsplan

### 1. `src/lib/codeplug/region.ts` (ny fil)

```text
RegionCountryCode = "SE"|"NO"|"DK"|"FI"|"AX"|"IS"|"SJ"|"FO"|"GL"|"unknown"
RegionInfo { countryCode, countryName, districtCode, districtLabel, sortKey, isSwedishDistrict, isNordic }
DISTRICT_REGION_MAP   // exakt enligt din tabell
COUNTRY_SORT_ORDER    // SE 10, NO 20, DK 30, FI 40, AX 45, IS 50, SJ 60, FO 70, GL 80, unknown 999
deriveRegion(districtRaw, callRaw?) → RegionInfo
```

- `districtCode` = uppercased trim av råvärdet ("6", "LA", "OH0").
- `districtLabel` = visningsnamn ("SM6", "LA", "OH0").
- `sortKey` = `${order}-${districtLabel}` zero-padded så strängsort fungerar.
- `isSwedishDistrict` = numeriskt 0–7.
- Okänt råvärde → `{ countryCode: "unknown", countryName: "Okänt", districtLabel: districtCode || "?", ... }`.

### 2. `models.ts`

- Lägg `region: RegionInfo` på `NormalizedChannel`. `district: string` bevaras.
- Utöka `FilterSettings`:
  ```
  countries: RegionCountryCode[];
  regions: string[];                    // districtLabel-värden
  includeUnknownRegions: boolean;
  /** @deprecated kvar för migration */ includeUnknownDistricts?: boolean;
  ```
  `districts: string[]` bevaras för bakåtkompabilitet men används inte av nya filterlogiken.

### 3. `pipeline.ts → normalize()`

- Anropa `deriveRegion(district, call)` och sätt `region` på varje normaliserad rad. Kanalpaket får `region` = unknown-singleton.

### 4. `filters.ts`

Ny logik (ersätter `/^\d+$/`-greppet):
```
if (f.countries.length && !f.countries.includes(c.region.countryCode)) return false;
if (c.region.countryCode === "unknown" && !f.includeUnknownRegions) return false;
if (f.regions.length && !f.regions.includes(c.region.districtLabel)) return false;
```

### 5. `sorting.ts`

- `districtOf()` ersätts internt av `regionSortKeyOf(c)` (= `c.region.sortKey`) för grupp-sortering i `sortOtherDistricts`.
- Numerisk sortering inom SE bevaras (sortKey "10-SM0".."10-SM7" sorterar lexikalt rätt).
- `home_district`-jämförelse fortsätter använda råvärdet `district` så svensk hemdistrikt fungerar oförändrat.

### 6. `naming.ts`

- Ny token `{region}` → `ch.region.districtLabel` (SM6, LA, OZ, OH0, OH6, TF, JW, JX, OY, OX). Tom om unknown.
- Ny token `{country}` → `ch.region.countryCode` (SE/NO/DK/FI/AX/IS/SJ/FO/GL).
- `{district}` lämnas oförändrad → fortsatt `D{rådata}` för bakåtkompabilitet.
- UI: lägg till `{region}` och `{country}` som valbara komponenter i NamingEditor.

### 7. `targets/split.ts → groupChannelsForSplit()`

- Gruppera repeatrar efter `region.sortKey` istället för rå district.
- Bucket-key/filename-slug = `${countryCode.toLowerCase()}_${districtLabel.toLowerCase()}` → `se_sm6`, `no_la`, `dk_oz`, `fi_oh6`, `ax_oh0`, `is_tf`, `sj_jw`, `sj_jx`, `fo_oy`, `gl_ox`.
- Label = `districtLabel`.
- Unknown-bucket: `key="unknown"`.
- Pack-buckets oförändrade.
- Befintlig deterministisk ordning bibehålls via sortKey.

### 8. `importers/sk6ba.ts → summarize()`

Lägg till i `Summary`:
```
countryCounts: Record<string, number>;     // countryCode → count
regionCounts: Record<string, number>;      // districtLabel → count
unknownRegionCount: number;
```
Existerande räknare (output/coords/shift/access) lämnas orörda.

### 9. `useCodeplugSettings.ts` — migration

I `loadStoredSettings`:
- Om `parsed.filter.includeUnknownDistricts` finns men `includeUnknownRegions` saknas → kopiera över.
- Om `countries`/`regions` saknas → använd DEFAULT (SE-only).
- Wrap i try/catch så gamla settings inte kan krascha appen.

### 10. `defaults.ts`

```
filter: {
  ...
  countries: ["SE"],
  regions: [],
  includeUnknownRegions: false,
  // bevarade legacy-fält:
  districts: [],
  includeUnknownDistricts: false,
}
```

### 11. `RepeaterFilterPanel.tsx`

Minimal UI:
- **Land** (MultiSelect): visar förekommande `region.countryName` ordnade enligt `COUNTRY_SORT_ORDER`. Snabbknapp **"Norden"** sätter SE/NO/DK/FI/AX/IS.
- **Region/distrikt** (MultiSelect): visar förekommande `region.districtLabel`, grupperade visuellt per land i optgroup om det är enkelt, annars en platt sorterad lista.
- Checkbox: **"Inkludera okända regioner"** (`includeUnknownRegions`).
- Befintlig svensk distrikt-MultiSelect tas bort. Sverige styrs nu via region-listan (SM0–SM7).

### 12. README

Lägg till sektion "Nordiskt stöd": listar tolkningstabellen, nya tokens `{region}`/`{country}`, nya split-filnamn, DMR-status oförändrad.

### 13. Tester

- `__tests__/region.test.ts` — alla mappningar i din lista + tomt/okänt.
- `__tests__/filters.test.ts` — utöka med nordiska rader.
- `__tests__/sorting.test.ts` — blandad svensk+nordisk grupp-ordning.
- `__tests__/naming.test.ts` — `{region}` och `{country}` för SE/NO/AX.
- `__tests__/targets/split.test.ts` — filename-slugs för LA/OZ/OH6/OH0/TF/JW.
- `__tests__/pipeline.test.ts` — `region` sätts på normaliserade rader.

## Acceptanskriterier

- `bun test` grön (befintliga tester anpassas där `filter.includeUnknownDistricts` testas).
- Svenska SK6BA-CSV producerar identiska exporter (CHIRP + VGC N76) som idag, förutom split-filnamn (`distrikt_6` → `se_sm6`). Om det är ett brott du vill undvika säg till — alternativt behåller vi `distrikt_N` för SE och använder regionnamn endast för icke-SE.
- LA/OZ/OH*/TF/JW/JX/OY/OX visas inte längre som "okänt".
- Filterpanelen har land + region. `{region}` valbart i naming.
- Gamla `sk6ba-chirp-settings-v6` i localStorage kraschar inte.

## Risker / öppna frågor

- **Split-filnamn för SE ändras** (`distrikt_6` → `se_sm6`). Vill du istället behålla `distrikt_N` för SE och bara använda nytt schema för utländska? Säg till.
- **Default `countries: ["SE"]`** — vill du ha Norden som default istället? Säg till.
- **Storage-nyckel**: Jag bumpar inte till `v7`; migrationen ovan räcker. Säg till om du hellre vill ha en ren cut.