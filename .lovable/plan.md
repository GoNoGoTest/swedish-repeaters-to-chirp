# Refactor: codeplug-mapp + VGC N76-exporter

Två sammanhängande steg i samma PR. CHIRP-output förblir byte-identisk (regression-test vaktar).

## 1. Rename `src/lib/chirp/` → `src/lib/codeplug/`

Mappnamnet `chirp` är vilseledande nu när vi också skriver för VGC-appen, RT Systems m.fl. — det är "codeplug-byggaren" som är gemensam, inte CHIRP.

- `git mv src/lib/chirp src/lib/codeplug`
- Uppdatera imports i:
  - `src/routes/index.tsx`
  - `src/lib/codeplug/models.ts` (interna paths)
  - `src/lib/codeplug/__tests__/targets/chirp-generic.test.ts`
  - `src/lib/codeplug/__tests__/targets/registry.test.ts`
  - `src/lib/codeplug/__tests__/exporters/chirp.test.ts`
- **Behåll** undermappen `targets/chirp-generic.ts` — CHIRP är fortsatt ett target, bara inte längre roten.
- **Behåll** STORAGE_KEY `v5` — strukturen ändras inte, bara modulnamn. Inga migrations behövs.
- `targets/registry.ts` och `targets/index.ts` får uppdaterade interna kommentarer som hänvisar till `codeplug/`.

Filer som flyttas (oförändrat innehåll utöver imports): `dedupe.ts`, `defaults.ts`, `distance.ts`, `district.ts`, `filters.ts`, `frequency.ts`, `geohash.ts`, `maidenhead.ts`, `models.ts`, `naming.ts`, `pipeline.ts`, `saved-exports.ts`, `sorting.ts`, `tones.ts`, samt undermapparna `__tests__/`, `channel_packs/`, `exporters/`, `importers/`, `targets/`.

## 2. Ny export-target: `vgc-n76`

### Filer
- `src/lib/codeplug/targets/vgc-n76.ts` — target-modul (exporter + settings-typ + validate).
- `src/lib/codeplug/targets/vgc-n76.panel.tsx` — settings-UI (power-default, bandwidth-default, max title-längd).
- `src/lib/codeplug/__tests__/targets/vgc-n76.test.ts` — regressions mot båda uppladdade sample-filerna.
- Registrering i `src/lib/codeplug/targets/index.ts`.

### CSV-format (16 kolumner, exakt headerrad som samplen)
```text
title,tx_freq,rx_freq,tx_sub_audio(...),rx_sub_audio(...),tx_power(H/M/L),
bandwidth(12500/25000),scan,talk around,pre_de_emph_bypass,sign,tx_dis,
bclo,mute,rx_modulation,tx_modulation
```

### Fältmappning från `NormalizedChannel`
| VGC-kolumn | Källa | Regel |
|---|---|---|
| `title` | `generated_name_final` | Trunka till `maxLength` (setting, default 16). UTF-8 OK. |
| `tx_freq` | `rx_frequency + tx_shift` (eller `tx_frequency` för packs) | Hz som heltal: `Math.round(MHz * 1_000_000)`. |
| `rx_freq` | `rx_frequency` | Hz som heltal. |
| `tx_sub_audio` | `ctcss_tx` ‖ `dtcs_code` | Se ton-kodning nedan. |
| `rx_sub_audio` | `ctone_freq` ‖ `dtcs_code` | Se ton-kodning nedan. |
| `tx_power` | setting `defaultPower` | `H`/`M`/`L`, default `H`. Per-rad-override ej i v1. |
| `bandwidth` | `mode_chirp` / `is_analog_fm` | `NFM` → `12500`, `FM` → `25000`. Default `12500`. |
| `scan` | `skip_raw` ∨ `skipLinks`-setting | `1` om kanalen ska skannas, annars `0`. Spegla nuvarande CHIRP-skip-logik (inverterad). |
| `talk around` | konstant `0` | Inte i mellanlagret. |
| `pre_de_emph_bypass` | konstant `0` | – |
| `sign` | konstant `1` | (samma som båda samplen) |
| `tx_dis` | `rx_only` | `1` om RX-only, annars `0`. |
| `bclo` | konstant `0` | – |
| `mute` | konstant `0` | – |
| `rx_modulation` | konstant `0` (FM) | AM-stöd kräver fält i mellanlagret — TODO. |
| `tx_modulation` | konstant `0` (FM) | dito. |

### Ton-kodning (bekräftat mot sample 2)
- **Ingen ton** → `0`
- **CTCSS** (Hz × 100): `114.8 Hz` → `11480`. Intervall ~6700–25410.
- **DCS** (oktal-kod som decimaltal): `D023` → `23`, `D731` → `731`. Intervall 0–777.
- **Disambiguering vid läsning** (för framtida import): `value < 1000` ⇒ DCS, `≥ 1000` ⇒ CTCSS. Här bara relevant för tester.
- **Polaritet (N/I) och andra DCS-paret är inte representerbara** i CSV:n. Vi emitterar bara N-polaritet. Varning `vgc_dcs_polarity_lost` om `dtcs_polarity` ≠ `NN`.

### Settings (lagras i `Settings.export.perTarget["vgc-n76"]`)
```ts
interface VgcN76Settings {
  maxLength: number;            // default 16
  defaultPower: "H" | "M" | "L"; // default "H"
  defaultBandwidth: 12500 | 25000; // default 12500
  channelsPerGroup: number;      // default 32 (för validate-varning)
  padToChannels: number | null;  // null = ingen padding; t.ex. 500 för full template
}
```

### Validate-varningar
Returneras från `target.validate(channels, settings)`, visas över exportknappen:
- `vgc_over_group_limit` — när antal kanaler > `channelsPerGroup` (default 32). Ej blockerande; appen importerar ändå, men användaren måste dela upp manuellt i v1.
- `vgc_dcs_polarity_lost` — när någon rad har DCS med I-polaritet eller ett andra par (info-varning).
- `vgc_title_truncated` — när någon `title` trunkerats.

### Nya WarningCodes
Lägg till i `models.ts`: `vgc_over_group_limit`, `vgc_dcs_polarity_lost`, `vgc_title_truncated`.

### Hårdvarugränser (HardwareLimits)
`vgc-n76` sätter:
```ts
{ maxChannels: 500, channelsPerGroup: 32, maxNameLength: 16 }
```
`pipeline.runPipeline` får redan `maxNameLength` via parameter — target läser från `limits.maxNameLength`. Truncation/splitting görs **inte** i v1 (bara varningar) per tidigare beslut.

### Padding / trailing tomma rader
Sample-filerna har 16 rader (data + tomma) i sample 2 och 32 rader i sample 1. Trolig orsak: appens template fyller alltid till nästa gruppgräns. **Default: ingen padding** (`padToChannels: null`). Användaren kan sätta `padToChannels: 32` om det krävs av appen — bekräftas i nästa runda om import till N76 faktiskt klagar utan padding.

### UI
`Sortering & export` har redan target-väljaren. När `vgc-n76` är valt:
- Visa `VgcN76Panel` (ersätter CHIRP-panelen) med fält för max title-längd, default power, default bandwidth, channels-per-group, padding.
- Exportknappens varningslista visar `target.validate(...)`-resultat.

## Tester
- `vgc-n76.test.ts`:
  - Header-rad exakt = sample-headern.
  - Mappar en repeater (rx 145.125, +600 shift, NFM, CTCSS 114.8) till sample-1-radens exakta värden för Kungsbacka-fallet.
  - Mappar en kanal med DCS-023/D731 till `tx_sub=731, rx_sub=23` (sample 2 rad 2).
  - 33 kanaler → exakt 1 instans av `vgc_over_group_limit`.
  - DCS med I-polaritet → exakt 1 instans av `vgc_dcs_polarity_lost`.
  - Title "ABCDEFGHIJKLMNOPQ" med maxLength=16 → trunkerad + varning.
- Befintliga 109 CHIRP-tester ska fortsatt passera oförändrade efter rename.

## Inte i denna PR
- AM-stöd (`rx/tx_modulation=1`) — kräver nytt fält i `NormalizedChannel`.
- Automatisk uppdelning i grupper om >32 — bara varning nu.
- Per-rad power/bandwidth-override.
- Import från VGC-CSV (vi bara exporterar).
- RT Systems, DMR/digitala moder.
