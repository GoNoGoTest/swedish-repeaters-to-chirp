## Mål

Reversera den tidigare "fyll med defaults"-fixen i CHIRP-CSV-exporten. Ton-/DCS-kolumner ska bara innehålla värden när raden faktiskt använder respektive funktion. Övriga defaults (Mode, TStep, Power, Offset) lämnas orörda.

## Varning

Detta upphäver den tidigare fixen som löste `could not convert string to float: ''` i CHIRP/Nicsure RMS. Du har bekräftat att vi kör ändå.

## Ändringar

### 1. `src/lib/chirp/exporters/chirp.ts`

- Ta bort konstanterna `DEFAULT_RTONE`, `DEFAULT_CTONE`, `DEFAULT_DTCS`, `DEFAULT_DTCS_POL`, `DEFAULT_RX_DTCS`, `DEFAULT_CROSS` och `DEFAULT_TONE_FIELDS`.
- Behåll `DEFAULT_POWER = "10.0W"`.
- Skriv om `resolveToneFields` så den returnerar tomma strängar i alla fält som inte är semantiskt aktiva för raden:
  - **Ingen access / Carrier / 1750 only / okänd:** alla sju ton-/DCS-fält tomma.
  - **CTCSS (SK6BA `ctcss_tx` eller pack `Tone`):** `Tone="Tone"`, `rToneFreq=<freq>`, övriga tomma. (cToneFreq tomt — inte TSQL.)
  - **Pack TSQL:** `Tone="TSQL"`, `rToneFreq` och `cToneFreq` satta, övriga tomma.
  - **Pack DTCS:** `Tone="DTCS"`, `DtcsCode`, `DtcsPolarity` satta, övriga tomma.
  - **SK6BA DCS från access:** `Tone="Cross"`, `DtcsCode`, `DtcsPolarity="NN"`, `CrossMode="DTCS->"`, övriga tomma (inkl. `rToneFreq`/`cToneFreq`/`RxDtcsCode`).
- CTCSS-före-DCS-prioriteringen behålls.

### 2. `src/lib/chirp/__tests__/exporters/chirp.test.ts`

Uppdatera de befintliga testerna som idag förväntar sig defaults:
- `"SK6BA without any tone leaves Tone empty but writes numeric defaults"` → byt namn och förvänta tomma fält.
- `"sets Tone when ctcss_tx present, with numeric defaults in unused tone fields"` → förvänta `cToneFreq=""`, `DtcsCode=""`, `DtcsPolarity=""`, `RxDtcsCode=""`, `CrossMode=""`.
- `"pack with tone=TSQL fills rTone and cTone"` → `DtcsCode=""`.
- `"pack with tone=DTCS fills only DTCS fields, defaults on tone freqs"` → `rToneFreq=""`, `cToneFreq=""`.
- `"pack with empty tone leaves Tone empty but writes numeric defaults"` → förvänta tomt.
- `"SK6BA with DCS access exports as Cross + DTCS-> with numeric tone defaults"` → `rToneFreq=""`, `cToneFreq=""`, `RxDtcsCode=""`.
- `"SK6BA with both CTCSS and DCS prefers CTCSS"` → `DtcsCode=""`, `CrossMode=""`.
- `"never produces empty rToneFreq, cToneFreq, ..."` → ersätt med motsatt invariant: ton-/DCS-fält är tomma om inte radens accessmodell aktivt använder dem; 88.5/023/NN/`Tone->` förekommer aldrig som filler.

Lägg till regressionsfall enligt specen:
- Carrier-rad (`access="Carrier"`) → alla sju ton-/DCS-fält tomma.
- 1750-only (`uses_1750=true`) → alla sju tomma.
- CTCSS 146.2 och 114.8 → endast `Tone` + `rToneFreq`.

### 3. Övrigt

- Header och kolumnordning (inkl. `Power` före `Comment`, inget `DVCODE`) behålls oförändrad.
- `pipeline.ts`, `tones.ts`, `models.ts` orörda — accessparsern fungerar redan.

## Verifiering

- `bunx vitest run` — alla tester (inkl. uppdaterade) ska passera.
- Manuell visuell kontroll: en KULLAVIK-liknande rad utan access ska få sju tomma kolumner mellan `Offset` och `Mode`.
