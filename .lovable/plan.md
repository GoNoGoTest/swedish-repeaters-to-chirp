# Nytt exportmål: Nicsure firmware (Radtel RT-880)

Ny target `nicsure-rt880` som producerar en CSV i Nicsures format. Ingen multifil-export i v1.

## CSV-format
Header (exakt, kommaseparerad, ingen trailing whitespace):

```
Channel_Num,Active,Name,RX,TX,RX_Tone,TX_Tone,TX_Power,Slot1,Slot2,Slot3,Slot4,Bandwidth,Modulation,BusyLock,Reversed,PTTID,Clarifier,Scrambler
```

### Fältmappning från `NormalizedChannel`

| Fält | Källa / regel |
|---|---|
| `Channel_Num` | `startLocation + i` (settings, default 1). |
| `Active` | Alltid `True` för exporterade rader. |
| `Name` | `generated_name_final`, klipps till `maxLength` (default 32, justerbart). |
| `RX` | `rx_frequency` i MHz med 5 decimaler (`toFixed(5)`). `0.00000` om saknas. |
| `TX` | Samma mobil-TX-beräkning som vgc-n76 (`mobileTxMhz`). 5 decimaler. |
| `RX_Tone`, `TX_Tone` | `None` om ingen ton; CTCSS `XX.X` (1 dec); DCS `D<3-digit><N|I>` (polaritet från `dtcs_polarity`, default `N`). |
| `TX_Power` | `settings.defaultPower` (`Very High`/`High`/`Medium`/`Low`). |
| `Slot1`..`Slot4` | Distrikts-/typ-mappning, se nedan. Tom = `" "` (ett blanksteg, som i exemplet). |
| `Bandwidth` | `mode_chirp === "NFM"` → `Narrow`, annars `Wide`. Settings-default vid okänt mode. |
| `Modulation` | `AM` → `AM`, annars `Auto` (radion väljer FM/NFM utifrån bandwidth). USB/CW → varning + `Auto`. |
| `BusyLock` | `False` (settings-default, ej per rad i v1). |
| `Reversed` | `False`. |
| `PTTID` | `Off`. |
| `Clarifier` | `0.00`. |
| `Scrambler` | `Off`. |

### Slot-mappning (v1, deterministisk)

Varje slot kan slås på/av i settings. När en slot är `off` skickas `" "`. När på:

- **Slot1 — land**: `SE→S`, `NO→N`, `DK→D`, `FI→F`, övriga/unknown → `" "`.
- **Slot2 — distriktssiffra**: första siffran i `district` (t.ex. `SM6→6`, `LA3→3`). Saknas → `" "`. Pack-kanaler → `" "`.
- **Slot3 — kanaltyp**: `Repeater→R`, `Link→L`, `Hotspot→H`, `Simplex→S`, annars `" "`.
- **Slot4 — kanalpaket-kategori**: pack-rader får första bokstaven (versal) av `category` (t.ex. `amateur→A`, `marine→M`, `pmr→P`, `cb→C`, `airband→I`, `hunting→H`). Repeatrar → `" "`.

Alla fyra defaultar till `on`. Tomma slots skrivs alltid som `" "` (matchar exemplet — Papa.unparse(quotes:false) bevarar blanksteget).

## Filer som ändras

### Nya
- **`src/lib/codeplug/targets/nicsure-rt880.ts`** — `NicsureRt880Settings`, `NICSURE_RT880_DEFAULTS`, `NICSURE_RT880_COLUMNS`, hjälpare (`encodeTone`, `encodeBandwidth`, `encodeModulation`, `slotForChannel`), `toNicsureRows`, `exportNicsureRt880Csv`, `NICSURE_RT880_TARGET`, `registerTarget(...)`.
- **`src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`** — header exakt, CTCSS-formatering (`67.0`, `100.0`), DCS m. polaritet (`D051N`, `D251I`), `None`-fall, Wide/Narrow, AM-mode, mobil-TX för duplex, slot-mappning per land/distrikt/typ/pack, `startLocation`-numrering, namn-trunkering.

### Ändrade
- **`src/lib/codeplug/targets/index.ts`** — `import "./nicsure-rt880";` + reexport av `NICSURE_RT880_TARGET`, `NICSURE_RT880_DEFAULTS`, `NicsureRt880Settings`.
- **`src/lib/codeplug/targets/registry.ts`** — utöka `TargetSettingsMap` med `"nicsure-rt880": NicsureRt880Settings`.
- **`src/components/codeplug/ExportPanel.tsx`** — ny `NicsureRt880Panel` (start-nummer, max namnlängd, default power, default bandwidth, fyra slot-toggles) och en motsvarande gren i `ExportPanel`-render baserad på `targetId === "nicsure-rt880"` (narrowing via `requireTarget`).
- **`src/hooks/useCodeplugDownload.ts`** — ny `case "nicsure-rt880":` i `invokeTarget` (samma form som chirp-generic).

## Settings-typ

```ts
export interface NicsureRt880Settings {
  startLocation: number;        // default 1
  maxLength: number;            // default 32
  defaultPower: "Very High" | "High" | "Medium" | "Low"; // default "Very High"
  defaultBandwidth: "Wide" | "Narrow";                    // default "Wide"
  slotCountry: boolean;   // default true
  slotDistrict: boolean;  // default true
  slotType: boolean;      // default true
  slotPackCategory: boolean; // default true
}
```

## Validering / varningar
- Inga hårda limits utöver namnlängd. `validate` returnerar varning om namn trunkerades samt om mode är USB/CW/LSB (exporteras som `Auto`/Wide med kommentar).

## Oförändrat
chirp-generic, vgc-n76, split.ts, pipeline, övrig UI. Inga ändringar av `NormalizedChannel`.
