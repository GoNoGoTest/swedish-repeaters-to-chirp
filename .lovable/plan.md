
## Insikt

Bokstäverna A–Z är **arbiträra identifierare** — Nicsure RMS-appen mappar varje bokstav till ett valfritt namn. Vi behöver alltså inte hitta "rätt" bokstav för Sverige eller Repeater; vi behöver bara tilldela en unik bokstav per distinkt grupp och ge användaren en lista över *vilken bokstav som blev vad* så hen kan namnge dem i RMS.

## Förslag: dimensions-baserad auto-tilldelning

Användaren väljer **vilka dimensioner** som ska grupperas på. För varje aktiv dimension samlar exporten alla unika värden i kanaldatat och tilldelar dem A, B, C, … i tur och ordning. En kanal hamnar i en zon-bokstav per aktiv dimension, max 4.

### Dimensioner (v1)

| ID | Källa på `NormalizedChannel` | Exempel-värden |
|----|------------------------------|----------------|
| `country` | `region.countryCode` | SE, NO, DK, FI |
| `district` | `district` (sk6ba) | SM6, SM7, SM3 |
| `type` | `type` | Repeater, Link, Hotspot, Simplex |
| `category` | `category` (channel pack) | marine, pmr, aviation |
| `pack` | `pack_name` / `pack_id` | "Marin VHF", "PMR446" |

(Vi kan börja med att skeppa `country`, `district`, `type`, `category` och lägga till fler senare — `pack` är en stub om fältet finns.)

### Tilldelningsregler

1. **Stabil ordning**: värden sorteras alfabetiskt inom varje dimension så samma indata alltid ger samma bokstav.
2. **Global bokstavspool**: A–Z delas mellan alla aktiva dimensioner. Dimensioner tilldelas i den ordning användaren listat dem; inom varje dimension går vi alfabetiskt.
3. **Kollision på fler än 26 värden**: överskjutande värden får ingen bokstav, warning emitteras (`nicsure_zone_pool_exhausted`).
4. **Per kanal**: hämta bokstaven för dess värde i varje aktiv dimension, max 4 → Slot1..Slot4 i dimensionsordningen. Tom dimension (kanal saknar värdet) = `" "`.
5. **Mer än 4 aktiva dimensioner**: UI tillåter max 4.

### Output till användaren

Två saker:
1. **CSV-filen** (oförändrat format, Slot1..4 fyllda).
2. **En "zon-legend"** — en separat textsektion / nedladdningsbar `.txt` som visar mappningen:

```
Slot1 — Country
  A = SE
  B = NO
  C = DK
  D = FI

Slot2 — District
  A = SM3
  B = SM6
  C = SM7

Slot3 — Type
  A = Hotspot
  B = Link
  C = Repeater
  D = Simplex
```

Det är legenden användaren skriver in i RMS för att döpa zonerna. Den visas i UI:t under exportknappen och kan kopieras/laddas ner.

## Implementation

### `src/lib/codeplug/targets/nicsure-rt880.ts`

Ny settings-shape:

```ts
export type NicsureZoneDimensionId =
  | "country" | "district" | "type" | "category";

export interface NicsureRt880Settings {
  startLocation: number;
  maxLength: number;
  defaultPower: NicsurePower;
  defaultBandwidth: NicsureBandwidth;
  /** Ordnad lista, max 4. Slot1 = zoneDimensions[0], osv. */
  zoneDimensions: NicsureZoneDimensionId[];
}

export const NICSURE_RT880_DEFAULTS: NicsureRt880Settings = {
  ...,
  zoneDimensions: ["country", "district", "type", "category"],
};
```

Nya helpers:

```ts
interface ZoneLegend {
  dimension: NicsureZoneDimensionId;
  slot: 1 | 2 | 3 | 4;
  entries: { letter: string; value: string }[];
  overflow: string[]; // värden som inte fick någon bokstav
}

function dimensionValue(c: NormalizedChannel, d: NicsureZoneDimensionId): string | null;

function buildZoneLegend(
  channels: NormalizedChannel[],
  dims: NicsureZoneDimensionId[],
): ZoneLegend[];
```

`buildZoneLegend` itererar dimensioner, samlar `unique sorted values`, plockar bokstäver A..Z. Pool delas globalt: om dimension 1 äter 4 bokstäver så börjar dimension 2 på E.

I `toNicsureRows`:
- Bygg `legend` en gång.
- Per kanal: för varje aktiv dimension, slå upp värdet → bokstav (eller `" "`).
- Slot5+ existerar inte → om `zoneDimensions.length > 4` slice:as till 4 (UI tillåter inte mer).
- Returnera även `legend` så `export()` kan exponera den.

Uppdaterad export-signatur:

```ts
export interface NicsureExportResult {
  csv: string;
  warnings: Warning[];
  legend: ZoneLegend[];
  legendText: string; // pre-formaterad för nedladdning/kopiering
}

export function exportNicsureRt880Csv(...): NicsureExportResult;
```

`NICSURE_RT880_TARGET.export()` returnerar fortfarande `{ filename, content, warnings }` (det är det generiska kontraktet). För legend lägger vi till en valfri **`extras`**-array av `{ filename, content }`:

```ts
// types.ts (ExportTarget):
export interface ExportResult {
  filename: string;
  content: string;
  warnings: Warning[];
  extras?: { filename: string; content: string }[];
}
```

Nicsure-targetet fyller `extras = [{ filename: "nicsure-rt880-zones.txt", content: legendText }]`. `useCodeplugDownload` zippar `content + extras` när `extras` är ifyllt; annars beteende oförändrat.

### `src/hooks/useCodeplugDownload.ts`

I `invokeTarget` för `case "nicsure-rt880"`: om resultatet har `extras`, paketera som zip (jszip finns redan i projektet, annars använd inbyggd Blob med multipart — kolla deps; om jszip saknas, ladda ner de två filerna separat eller bara serialisera legend som en kommentar i CSV-headern). **Enklare alternativ**: lägg legendtexten som en `# `-kommentar-header överst i CSV:n — men Nicsure-firmware kanske inte tolererar det. Säkrare: ladda ner två filer (browser tillåter två sekventiella `a.download`-klick med liten delay) **eller** rendera legend i UI:t (under exportpanelen) som kopierbar text utan att skapa en andra fil.

**Val (v1, enklast):** rendera legend i UI:t, ingen extra fil. Användaren kopierar texten manuellt till RMS. Behöver då inte ändra `ExportResult`-kontraktet.

→ `NICSURE_RT880_TARGET` exponerar legendText via en sidokanal (t.ex. en ny optional metod `previewExtras(channels, settings)` på `ExportTarget`, eller helt enkelt: ExportPanel kör `buildZoneLegend` direkt eftersom funktionen är ren).

**Slutgiltigt val**: lägg `buildZoneLegend` och `formatZoneLegend` som **publika exports** från `nicsure-rt880.ts`. `NicsureRt880Panel` importerar dem och visar legenden live när användaren ändrar `zoneDimensions`. Inga ändringar i `ExportTarget`-typen.

### `src/components/codeplug/ExportPanel.tsx`

`NicsureRt880Panel` ändras:
- Ersätt `slotCountry/slotDistrict/slotType/slotPackCategory`-checkboxar med en **ordnad lista** av dimensioner (drag-och-släpp ej nödvändigt i v1 — använd ↑/↓-knappar eller numrerad select per slot).
- Enklast: 4 dropdowns "Slot1 dimension", …, "Slot4 dimension" med värden `country | district | type | category | (ingen)`.
- Under panelen: rendera `formatZoneLegend(buildZoneLegend(channels, settings.zoneDimensions))` i en `<pre>` med "Kopiera"-knapp.
- Hjälptext: *"Varje bokstav (A–Z) är ett zon-ID som du namnger i Nicsure RMS-appen."*

### Tester

Uppdatera `nicsure-rt880.test.ts`:
- `buildZoneLegend` med 3 svenska repeaters i SM6/SM7 → country: A=SE, district: A=SM6 B=SM7, type: A=Repeater.
- Bokstavspool delas globalt: 4 länder + 3 distrikt → distrikt får E/F/G, inte A/B/C.
- >26 unika värden → warning + saknad bokstav.
- Kanal utan värde för dimension → `" "` i sin slot.
- `zoneDimensions: []` → alla fyra slottar `" "`.
- `formatZoneLegend` producerar förväntad text-output.

## Filer som ändras

- `src/lib/codeplug/targets/nicsure-rt880.ts` — settings, dimensions, `buildZoneLegend`, `formatZoneLegend`, `toNicsureRows`.
- `src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts` — slot→dimensions-tester.
- `src/components/codeplug/ExportPanel.tsx` — `NicsureRt880Panel` skrivs om med 4 dimension-dropdowns + live legend.

`registry.ts`, `useCodeplugDownload.ts`, `routes/index.tsx`, `targets/index.ts`, `ExportTarget`-typen: **oförändrade**.
