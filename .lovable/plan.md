# QTH och hemdistrikt-sortering för repeatrar

Lägg till QTH (Maidenhead-lokator) och hemdistrikt som inställningar. Hemdistriktet sorteras enligt valbar metod (avstånd från QTH som default), övriga distrikt geohash-grupperade i bokstavsordning. Kanalpaketen påverkas inte.

## Nya moduler

**`src/lib/chirp/maidenhead.ts`**
- `maidenheadToLatLon(grid: string): { lat: number; lon: number } | null`
- Stöd för 4, 6 och 8 tecken (JO67, JO67bp, JO67bp12)
- Validering: regex + range-kontroll, returnerar null vid ogiltig input

**`src/lib/chirp/distance.ts`**
- `haversineKm(a, b): number` — standard haversine, jordradie 6371 km
- Ren funktion, inga beroenden

**`src/lib/chirp/district.ts`**
- `extractDistrict(callsign: string): string | null` — plockar ut SM0–SM7, SK0–SK7 etc. ur svenska callsigns (prefix-bokstav + siffra, t.ex. "SK6BA" → "SM6", "SM7XYZ" → "SM7"). Normaliserar SK/SM/SA/SL/SI/7S → distriktssiffra "SM{n}".
- Hanterar edge cases: utländska anrop returnerar null

## Modelländringar

**`src/lib/chirp/models.ts`** — utöka `SortSettings`:
```ts
qth_maidenhead?: string;          // "JO67bp"
home_district?: string | null;    // "SM6" | null
home_district_sort: "distance" | "geohash" | "alphabetical";
home_district_first: boolean;     // toggle, default true om hemdistrikt satt
```
- Övriga distrikt: alltid geohash inom distriktet, distrikten i bokstavsordning (ej konfigurerbart)
- Befintlig `sort_keys` blir fallback när inget hemdistrikt är satt

## Sortering

**`src/lib/chirp/sorting.ts`** — ny path för repeatrar när `home_district` är satt:
1. Dela upp repeater-rader i `home` och `others` baserat på `extractDistrict(callsign) === home_district`
2. Sortera `home` enligt `home_district_sort`:
   - `distance` — beräkna avstånd från QTH via maidenhead→latlon→haversine; rader utan koordinater sist
   - `geohash` — befintlig geohash-logik
   - `alphabetical` — på callsign/namn
3. Sortera `others` per distrikt (bokstavsordning), inom varje distrikt geohash
4. Konkatenera: `home` → `others` (om `home_district_first`) eller infoga `home` på rätt alfabetisk position
5. Kanalpaket-rader sorteras separat som idag (PackPlacement avgör var de hamnar relativt repeatrarna)

## UI

**`src/routes/index.tsx`** — i Sortering & CHIRP-export-sektionen, ny undersektion "QTH och hemdistrikt" som bara påverkar repeatrar:
- Textfält: QTH (Maidenhead-lokator), placeholder "JO67bp", live-validering
- Select: Hemdistrikt (SM0–SM7, "(inget)")
- Radio: Sortering inom hemdistrikt — Avstånd från QTH / Geohash / Alfabetiskt
- Checkbox: Visa hemdistrikt först
- Hjälptext: "Övriga distrikt sorteras geohash-grupperat i bokstavsordning"
- Disable distansvalet om QTH saknas, med tooltip

Bumpa localStorage-nyckel till `v4`.

## Tester

- `maidenhead.test.ts` — JO67bp ≈ (57.604, 14.708), invalid input, 4/6/8-tecken
- `distance.test.ts` — kända avstånd (Göteborg–Stockholm ≈ 397 km)
- `district.test.ts` — SK6BA→SM6, SM7XYZ→SM7, DL1ABC→null
- `sorting.test.ts` — utöka: hemdistrikt först, distansordning, fallback utan QTH

## Verifiering

`bunx vitest run` + `npx tsc --noEmit`, manuell sanity check i preview med en SK6BA-CSV.
