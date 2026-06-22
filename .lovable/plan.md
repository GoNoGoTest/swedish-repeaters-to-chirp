# CHIRP Generic CSV — korrigera header, mode-mappning och digital-varning

Verifierade fynden mot källfilerna (`src/lib/codeplug/exporters/chirp.ts`, `targets/chirp-generic.ts`, `models.ts`, `pipeline.ts`):

- **DVCODE saknas** i `CHIRP_COLUMNS` (verifierat: 20 kolumner, ingen DVCODE). Stämmer.
- **Mode-mappning är fel**: `resolveMode` använder bara `c.mode_chirp` för pack-rader och annars `s.mode`. `c.mode_effective` (satt av pipeline:n för SK6BA‐rader, t.ex. `"C4FM"`, `"D-Star"`, `"DMR"`) ignoreras helt. Stämmer.
- **Ingen varning** finns för digitala moder i CHIRP-exporten idag. Stämmer.
- **Tonlogiken** (defensiva defaults för `rToneFreq`/`cToneFreq`/`DtcsCode`/`DtcsPolarity`/`RxDtcsCode`/`CrossMode`) lämnas orörd.

## Ändringar

### 1. `src/lib/codeplug/exporters/chirp.ts`

- Lägg `"DVCODE"` sist i `CHIRP_COLUMNS`. Exportera som tom sträng.
- Ny `resolveMode(c, fallback)`:
  1. `c.source_type === "channel_pack"` och `c.mode_chirp` → `c.mode_chirp` (oförändrat).
  2. Annars mappa `c.mode_effective`:
     - `"FM"` → `fallback` (`settings.mode`, dvs `"NFM"`/`"FM"`)
     - `"C4FM"` → `"DN"`
     - `"D-Star"` → `"DV"`
     - `"DMR"` → `"DMR"`
     - `"DMRplus"` → `"DMR"`
     - `"P25"` → `"P25"`
     - `"CW"` → `"CW"`
     - `"Tetra"`, tomt eller okänt → `fallback`
- Ny exporterad helper `chirpDigitalWarnings(channels): Warning[]` som returnerar **en** icke-blockerande varning (code: `unknown_mode` återanvänds — befintliga koder räcker; eller vi kan lägga till `"chirp_digital_partial"` i `WarningCode` för tydlighet — väljer det senare för spårbarhet) när minst en kanal har `mode_effective ∈ {C4FM, D-Star, DMR, DMRplus, P25}`. Meddelandetext på svenska enligt spec.

### 2. `src/lib/codeplug/models.ts`

- Lägg till `"chirp_digital_partial"` i `WarningCode`-unionen.

### 3. `src/lib/codeplug/targets/chirp-generic.ts`

- `supportedModes` → `["NFM","FM","WFM","AM","NAM","DV","DN","DMR","P25","CW","USB","LSB","RTTY","DIG","PKT"]`.
- `supportedSignalModes` lämnas som idag (`["FM","C4FM","D-Star","DMR","DMRplus","P25","Tetra","CW"]`).
- `export()` returnerar nu `warnings: chirpDigitalWarnings(channels)` istället för `[]`.
- `exportMany`/`buildSplitFiles`: varningar är globala per export, så vi behåller dem på single-export-path; multi-file behåller nuvarande beteende (varningar visas via `validate`-vägen vid behov — lägg in `validate: (ch) => chirpDigitalWarnings(ch)` så att UI:n får varningen oavsett split).

### 4. Tester (`src/lib/codeplug/__tests__/exporters/chirp.test.ts` + `targets/chirp-generic.test.ts`)

- Uppdatera `EXPECTED_HEADER` att sluta med `,DVCODE`.
- Uppdatera "never produces empty …"-testet — DVCODE får vara tom.
- Nya cases (SK6BA-kanal via `makeChannel({ mode_effective: ... })`):
  - `C4FM` → `Mode === "DN"`
  - `D-Star` → `Mode === "DV"`
  - `DMR` → `Mode === "DMR"`
  - `DMRplus` → `Mode === "DMR"`
  - `P25` → `Mode === "P25"`
  - `FM` med `settings.mode = "NFM"` → `Mode === "NFM"` (regression)
  - `channel_pack` med `mode_chirp: "USB"` och `mode_effective: "C4FM"` → `Mode === "USB"` (override-regression bibehållen)
- Target-test: export av en kanal med `mode_effective: "C4FM"` → `result.warnings` innehåller exakt en varning med svensk text om "CHIRP Generic CSV"/"digitala".
- Target-test: export av bara `FM`-kanaler → `result.warnings.length === 0`.

## Teknisk not

`makeChannel`-helpern måste tillåta att `mode_effective` sätts. Verifieras vid implementation; annars läggs default = `""` och vi sätter värdet explicit i testet.
