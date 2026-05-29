## Korrekt tonexport i CHIRP — inga filler-defaults

### Problem
`exporters/chirp.ts` skriver alltid värden i `cToneFreq`, `DtcsCode`, `DtcsPolarity` (88.5 / "23" / "NN") även när raden inte använder TSQL eller DTCS. Det är farligt — i radioskanrar kan det aktivera mottagar-tonskelch och göra kanalen "tyst". `cToneFreq` är dessutom exponerad som global användarinställning, vilket inbjuder till samma misstag.

### Regler för Tone-fält per rad
- **Ingen ton**: `Tone="" rToneFreq="" cToneFreq="" DtcsCode="" DtcsPolarity=""`.
- **Vanlig sänd-CTCSS** (SK6BA-access eller pack utan `tone="TSQL"`): `Tone="Tone" rToneFreq=<CTCSS> cToneFreq="" DtcsCode="" DtcsPolarity=""`.
- **TSQL uttryckligen angivet** (endast paket med `tone="TSQL"`): `Tone="TSQL" rToneFreq=<CTCSS> cToneFreq=<CTCSS>`.
- **DTCS/DCS uttryckligen angivet** (paket med `tone="DTCS"` + `dtcs_code`): `Tone="DTCS" DtcsCode=<kod> DtcsPolarity=<pol|NN>`, övriga ton-fält tomma.
- **Cross**: utanför scope just nu — om `tone_raw` är annat än ovan, behandla som "Ingen ton" och varna.

`RxDtcsCode` och `CrossMode` lämnas tomma utom när DTCS/Cross faktiskt används.

### Defaults — endast där de inte ändrar radiobeteendet
- `Location` startnummer: behåll, användarval (default 1). OK.
- `Mode` för SK6BA FM-rader: behåll global default NFM. OK.
- `TStep`: behåll global default 5.0 om paketet inte anger annat. OK.
- `Offset`: `0.000000` endast när `duplex=""` (simplex verifierat via `parseShift`). Behåll.
- `Skip`: tomt om användaren inte valt skip — redan korrekt, behåll.

### Ändringar

**`src/lib/chirp/exporters/chirp.ts`**
- Ersätt nuvarande Tone/DTCS-logik med en helper `resolveToneFields(c)` som returnerar `{ Tone, rToneFreq, cToneFreq, DtcsCode, DtcsPolarity, RxDtcsCode, CrossMode }` enligt reglerna ovan. Inga fallbacks till `s.cToneFreq`, `"23"`, `"NN"`, eller `88.5`.
- SK6BA-rad: om `ctcss_tx != null` → "Tone"-grenen. Annars tomt (även om `uses_1750` är true; 1750 Hz hanteras inte av CHIRP-tone-fältet).
- Pack-rad: läs `tone_raw` (case-insensitive) — "TSQL"/"DTCS"/"Tone"/"" styr grenen. `rtone_freq`/`ctone_freq`/`dtcs_code`/`dtcs_polarity` används direkt från paketet.

**`src/lib/chirp/models.ts`**
- Ta bort `cToneFreq: number` från `ChirpSettings`.

**`src/lib/chirp/defaults.ts`**
- Ta bort `cToneFreq: 88.5` från `DEFAULT_SETTINGS.chirp`.

**`src/routes/index.tsx`**
- Ta bort `NumberField "cToneFreq (Hz)"` (rader 813–815) och tillhörande `updChirp({ cToneFreq })`.

**`src/lib/chirp/__tests__/exporters/chirp.test.ts`**
- Uppdatera "sets Tone when ctcss_tx present"-testet: förvänta `cToneFreq=""`, `DtcsCode=""`, `DtcsPolarity=""`.
- Nya tester:
  - SK6BA utan CTCSS → alla ton-fält tomma.
  - Pack med `tone="TSQL"` + `ctone_freq=123` → `Tone=TSQL`, `cToneFreq=123.0`.
  - Pack med `tone="DTCS"` + `dtcs_code="411"` → endast DTCS-fält fyllda, `rToneFreq`/`cToneFreq` tomma.
  - Pack med tomt `tone` och tomt `rtone_freq` → alla ton-fält tomma.

**Migration**: `loadStoredSettings` — strippa `cToneFreq` från sparade `settings.chirp` så gamla lagrade värden inte återinjicieras.

### Verifiering
`bunx vitest run` — alla existerande + nya tester ska passera. Manuell spotcheck av CSV-export för en simplex-kanal utan ton (alla 5 ton-kolumner tomma) och en repeater med CTCSS 123.0 (`Tone="Tone"`, `rToneFreq="123.0"`, `cToneFreq=""`).
