## Mål

Separera analog access från digital access i datamodellen. CHIRP-exporten slutar förorena digitala kanaler med CTCSS, och framtida exportmål (RT Systems DMR, riktig C4FM/D-Star/P25) kan läsa strukturerade digitalfält direkt från `NormalizedChannel`.

Princip: **rensa inte information — rensa fel kanal.**

## Scope

Refaktor av: `tones.ts`, ny `accessModes.ts`, `models.ts`, `pipeline.ts`, `importers/channel_pack.ts`, `exporters/chirp.ts`. Inga ändringar i exportformatet för VGC, NiCSURE eller RT Systems Yaesu — verifieras med snapshot.

## 1. `tones.ts` — separata funktioner, ingen brytande shape

`parseAccess(raw): ToneParse` behåller exakt samma returshape (`{ ctcss, uses1750, carrier, dcs }`). Inga callers ändras.

**Minimal bugfix tillåten:** befintlig tokenisering splittrar på whitespace, vilket gör att `"no tone"` aldrig matchar `CARRIER_RE` (som har `no\s*tone` men aldrig får två-ord-strängen). Förbehandling: innan whitespace-split, kollapsa `no\s+tone` → `no_tone` (eller motsvarande sentinel som CARRIER_RE accepterar). Returtypen är oförändrad; det är ren parserkorrigering. Test läggs till: `parseAccess("no tone").carrier === true`.

Ny funktion bredvid:

```ts
export interface DigitalAccess {
  dmr:  { colorCode: number | null; timeSlot: number | null; talkGroup: string };
  c4fm: { dgIdTx: number | null; dgIdRx: number | null };
  p25:  { nac: string };
  unknownTokens: string[];
}
export function parseDigitalAccess(raw: string | undefined | null): DigitalAccess;
```

Tokenmönster (case-insensitive, hanterar ihopskrivet, separerat och `=`-form):

- `CC <n>`, `CC=<n>`, `CC6`, `CC06` → `dmr.colorCode` (0–15)
- `TS <n>`, `TS=<n>`, `TS1`, `TS2` → `dmr.timeSlot` (1|2)
- `TG <id>`, `TG=<id>`, `TG91`, `TG240` → `dmr.talkGroup`
- `TX <nn>`, `TX=<nn>`, `TX00` / `RX <nn>`, `RX=<nn>`, `RX00` → `c4fm.dgIdTx` / `c4fm.dgIdRx` (00–99)
- `NAC <hex>`, `NAC=<hex>`, `NAC293` (3 hex) → `p25.nac`

`unknownTokens` får ENDAST verkligt okända fragment. Alla tokens som `parseAccess` skulle konsumerat (CTCSS-kandidat 40–300, `1750`, carrier-synonymer `carrier|open|none|ingen|no tone`, alla DCS-former) filtreras bort från unknown-listan.

## 2. Ny modul `src/lib/codeplug/accessModes.ts`

```ts
export type AccessClass = "analog" | "dmr" | "c4fm" | "dstar" | "p25" | "tetra" | "none";

export function classifyMode(mode: string): AccessClass {
  const m = (mode || "").toUpperCase();
  if (m === "" || m === "FM" || m === "NFM" || m === "WFM") return "analog";
  if (m === "DMR" || m === "DMRPLUS" || m === "DMR+") return "dmr";
  if (m === "C4FM" || m === "DN") return "c4fm";
  if (m === "D-STAR" || m === "DSTAR" || m === "DV") return "dstar";
  if (m === "P25") return "p25";
  if (m === "TETRA") return "tetra";
  return "none"; // CW och övrigt
}

export function isAnalogToneMode(c: NormalizedChannel): boolean { /* m_effective / m_pack */ }
```

CW räknas inte som analog tone-mode. Tom mode klassas konservativt som `"analog"`. Synonymer (`DV`, `DN`, `DSTAR`, `DMR+`) klassas till rätt klass.

## 3. Nya fält i `NormalizedChannel` (`models.ts`)

```
analog_carrier_open:   boolean;        // från parseAccess.carrier
dmr_color_code:        number | null;
dmr_timeslot:          number | null;
dmr_talkgroup:         string;
c4fm_dg_id_tx:         number | null;  // C4FM/DG-ID-liknande metadata
c4fm_dg_id_rx:         number | null;  // ej komplett System Fusion-programmering
p25_nac:               string;
digital_access_raw:    string;
access_unknown_tokens: string[];
```

`access_raw` dokumenteras: **källfältets råa accessteckenström — kan innehålla både analoga och digitala tokens**.

JSDoc på `c4fm_dg_id_*`: "C4FM/DG-ID-liknande metadata från SK6BA `access`-fältet. Framtida exportmål får inte anta att detta ensamt räcker för komplett System Fusion-programmering."

Inga nya `WarningCode`-värden.

## 4. `pipeline.ts` — mode-medveten subset efter expansion

I `normalize()`:
- `parseAccess(r.access)` fyller `ctcss_tx`, `uses_1750`, `dtcs_code`, `dtcs_polarity`, **och nya `analog_carrier_open = access.carrier`**.
- `parseDigitalAccess(r.access)` fyller digitala fält + `access_unknown_tokens`.
- `missing_access_tone` och `ctcss_and_dcs` skapas **inte** här.

`runPipeline` kör efter `expandModes`: `applyModeAccessSubset(c)` för **alla** kanaler (även pack-rader):

| `classifyMode` | Analog fält (`ctcss_tx`, `uses_1750`, `dtcs_code`, `dtcs_polarity`, `analog_carrier_open`) | Digitala fält | `digital_access_raw` |
| -------------- | ------------------------------------------------------------------------------------------ | ------------- | -------------------- |
| `analog`       | behåll                                                                                     | nollas        | `""`                 |
| `dmr`          | nollas                                                                                     | behåll DMR    | `access_raw`         |
| `c4fm`         | nollas                                                                                     | behåll C4FM   | `access_raw`         |
| `dstar`        | nollas                                                                                     | (inga strukt.) | `access_raw`        |
| `p25`          | nollas                                                                                     | behåll `p25_nac` | `access_raw`      |
| `tetra`        | nollas                                                                                     | (inga strukt.) | `access_raw`        |
| `none` (CW)    | nollas                                                                                     | nollas         | `""`                |

Mode-beroende varningar efter subset:

- **`missing_access_tone`** när `classifyMode === "analog"` OCH `ctcss_tx == null && uses_1750 === false && analog_carrier_open === false && dtcs_code === ""`. Gäller även om `access_raw` är tomt.
- **`ctcss_and_dcs`** när `classifyMode === "analog"` OCH både `ctcss_tx != null` och `dtcs_code !== ""`.
- Digitala mode-rader får inga access-varningar.

## 5. `importers/channel_pack.ts` — konservativ digitalparsning

Behåll all befintlig läsning av `tone`, `rtone_freq`, `ctone_freq`, `dtcs_code`, `dtcs_polarity` exakt som idag.

**Utöka `knownModes`** (inkluderar både `DMRPLUS` och `DMR+`, konsekvent med `classifyMode`):

```ts
const knownModes = ["NFM","FM","USB","LSB","CW","AM","DV","DIG","DMR","DMRPLUS","DMR+","C4FM","P25"];
```

Kör `parseDigitalAccess(r.tone)` endast om strängen matchar:

```ts
const DIGITAL_TONE_RE =
  /(?:\bCC\s*=?\s*\d{1,2}\b|\bTS\s*=?\s*[12]\b|\bTG\s*=?\s*[\w-]+\b|\bNAC\s*=?\s*[0-9A-F]{3}\b|\b(?:TX|RX)\s*=?\s*\d{2}\b)/i;
```

`tone=TSQL|Tone|DTCS` matchar inte. `tone=CC1|TS2|TG91|NAC293|TX00|TX 00|TX=00` matchar.

Inga nya pack-CSV-kolumner.

## 6. CHIRP-exporten (`exporters/chirp.ts`)

```ts
import { isAnalogToneMode } from "../accessModes";

function resolveToneFields(c: NormalizedChannel): ToneFields {
  if (!isAnalogToneMode(c)) return { ...DEFAULT_TONE_FIELDS };
  // befintlig analog-logik orörd
}
```

`resolveComment(c)` utökas:
- DMR-kanal: append `DMR CC=<n>` (+ `TS=<n>` / `TG=<id>` om satta).
- C4FM-kanal: append `C4FM TX=<nn>` / `RX=<nn>` om satta.
- P25-kanal: append `P25 NAC=<hex>` om satt.
- **`analog tone ignored for <MODE>`** läggs till om kanalen är digital och `parseAccess(digital_access_raw)` returnerar `ctcss != null || uses1750 || carrier || dcs != null`.

Befintlig `chirp_digital_partial`-filvarning bevaras.

## 7. Tester

- **`tones.test.ts`** — befintliga `parseAccess`-tester orörda. Lägg till regression: `parseAccess("no tone").carrier === true`.

- **`parseDigitalAccess`** (nya tester):
  - DMR-varianter: `CC6`, `CC 1`, `CC=1`, `CC06`, `TS2`, `TS=2`, `TG91`, `TG=240`.
  - C4FM-varianter: `TX00`, `TX 00`, `TX=00`, `RX00`, `RX 00`, `RX=00`.
  - P25-varianter: `NAC293`, `NAC 293`, `NAC=293`.
  - Blandat: `123.0 / CC 1` → `dmr.colorCode=1`, `unknownTokens: []`.
  - `unknownTokens` tom för: `123.0`, `1750`, `DCS023`, `DTCS 025`, `D025`, `carrier`, `open`, `none`, `ingen`, `no tone`.
  - `XYZ42` → `unknownTokens: ["XYZ42"]`.

- **`accessModes.test.ts`** (ny): `FM`/`NFM`/`WFM`/`""` → `"analog"`; `CW` → `"none"`; `DMR`/`DMRPLUS`/`DMR+` → `"dmr"`; `C4FM`/`DN` → `"c4fm"`; `D-STAR`/`DSTAR`/`DV` → `"dstar"`; `P25` → `"p25"`; `TETRA` → `"tetra"`.

- **`pipeline.modeSubset.test.ts`** (ny): SK6BA `mode_raw="FM / DMR"`, `access="123.0 / CC 1"` → FM behåller `ctcss_tx=123.0`, DMR har `ctcss_tx=null`, `dmr_color_code=1`, `digital_access_raw="123.0 / CC 1"`.

- **`pipeline.test.ts`**:
  - FM utan access → `missing_access_tone`.
  - FM `access="carrier"` → ingen varning (`analog_carrier_open === true`).
  - FM `access="no tone"` → ingen varning.
  - FM med CTCSS och DCS → `ctcss_and_dcs`.
  - DMR utan analog tone → inga access-varningar.
  - DMR med CTCSS och CC → inga access-varningar; `ctcss_tx == null` efter subset.

- **`exporters/chirp.test.ts`**:
  - DMR utan analog token: Tone-defaults, Comment `DMR CC=1`, ingen `analog tone ignored`.
  - DMR `access="123.0 / CC 1"`: Comment `DMR CC=1` + `analog tone ignored for DMR`.
  - DMR `access="DCS023 / CC 1"`: Comment `analog tone ignored for DMR` (DCS-gren).
  - DMR `access="1750 / CC 1"`: Comment `analog tone ignored for DMR` (1750-gren).
  - FM oförändrad.

- **`importers/channel_pack.test.ts`**:
  - `tone=TSQL`, `rtone_freq=88.5` → inga digitalfält, `access_unknown_tokens=[]`.
  - `tone="CC1"` på DMR pack → `dmr_color_code=1`, ingen `pack_unsupported_mode`.
  - `mode=DMR+` ensam → ingen `pack_unsupported_mode`.

- **Regressionssnapshot** under `__tests__/targets/`: blandad SK6BA-input (FM + DMR + C4FM) genom VGC, NiCSURE, RT Systems Yaesu. Byte-för-byte mot fixture i `__tests__/fixtures/`.

## 8. Migrering / bakåtkomp

- `parseAccess`-shape oförändrad. `"no tone"` tolkas nu korrekt (bugfix).
- Persisted settings oförändrade.
- CHIRP: Tone-defaults för digitala rader (önskad fix).
- VGC/NiCSURE/RT Systems Yaesu: byte-identiska, verifierat via snapshot.
- Pack-importer accepterar DMR/DMRPLUS/DMR+/C4FM/P25 utan `pack_unsupported_mode`.

## 9. Verifiering

`bun run verify` ska vara grön (typecheck + lint + tester + format + build).

## Utanför scope

- Strukturerad export av DMR/C4FM/P25.
- Nya pack-CSV-kolumner för digital access.
- UI för att redigera CC/TG/DG-ID/NAC.
- Ny `WarningCode` för "digital_access_unparsed".
- Ändringar i `channelKey()` eller statistikfilter.
