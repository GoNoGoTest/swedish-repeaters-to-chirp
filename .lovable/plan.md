## Översikt

Tre sammankopplade ändringar:

1. **Mode-katalog & multi-mode-expansion** i pipelinen — en SK6BA-rad med `mode="FM / C4FM"` blir en kanal per markerat mode i filtret.
2. **Mode-toggles i UI** ersätter dropdownen för mode-strategi. Alla kända modes visas; de som inte stöds av valt exportmål visas utgråade och kan inte väljas. `{mode}`-token för namngivning.
3. **Nytt exportmål** "RT Systems Yaesu ???" (placeholder-namn) som stödjer FM + C4FM (`Operating Mode = FM` / `DN`).

Kanalpaket berörs inte av mode-expansion — de har redan ett bestämt `mode_raw`/`mode_chirp` per rad.

## Implementation

### 1. Mode-katalog — ny fil `src/lib/codeplug/modes.ts`

- `KNOWN_MODES = ["FM","C4FM","D-Star","DMR","DMRplus","P25","Tetra","CW"]` plus aliasregister (`"DSTAR"→"D-Star"`, `"YSF"→"C4FM"`, `"DN"→"C4FM"`).
- UI presenterar **alla** `KNOWN_MODES` som toggles (ingen separat `TOGGLE_MODES`-lista).
- `parseModes(raw: string): string[]` — splittar på `/` / `,` / whitespace, normaliserar via aliastabellen, dedupar i ordning. `"FM / C4FM"` → `["FM","C4FM"]`. `""` → `[]`.

### 2. Stöd-deklaration per exportmål

`HardwareLimits.supportedModes` finns redan men har idag CHIRP-internt vokabulär (`NFM`/`FM`/`AM`/…). Lägg till ett separat fält:

```text
HardwareLimits.supportedSignalModes?: string[]   // delmängd av KNOWN_MODES
```

Sätt per target:
- `chirp-generic` → alla `KNOWN_MODES` (CHIRP kan i princip exportera allt analogt; digitala modes går igenom som `Mode=FM` med kommentar — inget vi blockerar).
- `vgc-n76` → `["FM"]` (analog only).
- `nicsure-rt880` → `["FM"]` (analog only).
- `rt-systems-yaesu-generic` → `["FM","C4FM"]`.

Om fältet utelämnas faller UI tillbaka till "alla stöds" så att andra existerande targets fortsätter fungera.

### 3. `NormalizedChannel` (`src/lib/codeplug/models.ts`)

- Lägg till `mode_effective: string` — det mode raden faktiskt exporteras under. För kanalpaket = `mode_chirp || mode_raw`. För SK6BA = en av parserna från `mode_raw` (sätts av expansion-steget).
- Behåll `mode_raw` och `is_analog_fm` oförändrade.

### 4. `FilterSettings` ersätt mode-strategin

```text
modes: string[]    // markerade modes; tom = "släpp ingenting på mode"
```

Migrering vid läsning av gamla persistade settings:
- `modeStrategy="contains_fm"|"exact_fm"` → `modes: ["FM"]`
- `modeStrategy="all"` → `modes: []`
- `modeStrategy="custom"` → `modes: customModes` (efter normalisering via alias)

Behåll `modeStrategy`/`customModes` som `@deprecated` valbara fält så befintliga objekt inte kraschar; pipeline läser bara `modes`.

### 5. Pipeline-expansion (`src/lib/codeplug/pipeline.ts`)

Nytt steg `expandModes(channels, selectedModes)` som körs **före** `applyFilters` på SK6BA-rader:

```text
för varje sk6ba-kanal c:
  parsed = parseModes(c.mode_raw)
  if parsed.length === 0:
    yield { ...c, mode_effective: "" }
  else:
    kept = selectedModes.length ? parsed.filter(m ∈ selectedModes) : parsed
    if kept.length === 0:
      yield { ...c, mode_effective: parsed[0] }   // faller bort i filter
    else for m in kept:
      yield { ...c, mode_effective: m, warnings: [...c.warnings] }
```

`applyFilters` slutar gate:a på `modeStrategy` — mode-gatekeeping görs nu helt av expansion-steget. Övriga filter (status/typ/band/region) oförändrade.

### 6. Naming `{mode}`-token (`src/lib/codeplug/naming.ts`)

- `{mode}` → `ch.mode_effective` (sanitized, via valfri `abbreviations.mode`).
- Lägg till valfri `abbreviations.mode: Record<string,string>` (default tom) i `NamingSettings`.
- `DEFAULT_REPEATER_NAMING` ändras **inte** — användaren lägger till `{mode}` själv när hen vill ha mode i namnet. Lägg en Hint i NamingEditor.

### 7. UI — `RepeaterFilterPanel.tsx`

Byt ut dropdownen mot en grupp checkbox-toggles, **en per `KNOWN_MODES`-post**, i fast ordning. Etikett "Modes (tomt = alla)". Spara i `settings.filter.modes`.

Beräkna `supportedSet` från aktivt target via `getTarget(settings.export.targetId).limits.supportedSignalModes` (fallback = alla).

Per toggle:
- Om mode ∈ `supportedSet`: enabled, vanlig checkbox.
- Om mode ∉ `supportedSet`: `disabled`, opacity-50, tooltip "Stöds inte av {target.label}". Om mode redan är markerat i `settings.filter.modes` visas det fortfarande som markerat men är låst (vi rör inte settings när användaren byter target — kanalerna faller då bort vid export, med en warning, vilket är acceptabelt och reversibelt).

`RepeaterFilterPanel` behöver `targetId` (och därmed targets-registret); enklast är att läsa det från `settings.export.targetId` som redan finns i propsen.

`NamingEditor.tsx`: lägg till `{mode}` i token-paletten.

### 8. Nytt exportmål `src/lib/codeplug/targets/rt-systems-yaesu.ts`

Headers från bifogad CSV (notera ledande tom kolumn för radnummer och avslutande tom kolumn):

```text
,Receive Frequency,Transmit Frequency,Offset Frequency,Offset Direction,
Operating Mode,AMS,Name,Tone Mode,CTCSS,DCS,RX DGID,TX DGID,User CTCSS,
Tx Power,Skip,Step,Clock Shift,Memory Group,Comment,
```

Mappning per kanal:

```text
Receive Frequency  : rx_frequency.toFixed(5)
Transmit Frequency : tx_frequency || rx + tx_shift (eller rx för simplex/off)
Offset Frequency   : "" för Simplex/off, annars "600 kHz" (abs(offset)*1000 kHz, en decimal vid behov)
Offset Direction   : duplex "+"→Plus, "-"→Minus, "split"→Split, "off"/simplex→Simplex
Operating Mode     : mode_effective FM→"FM", C4FM→"DN"; övriga → fallback "FM" + warning
AMS                : settings.defaultAms (default "N")
Name               : generated_name_final klippt till settings.maxLength (default 16)
Tone Mode          : från ctcss_tx/dcs/tone_raw → "None"/"Tone"/"T Sql"/"DCS"
CTCSS              : ctcss_tx.toFixed(1) || "100.0"
DCS                : dtcs_code (3 siffror) || "023"
RX DGID / TX DGID  : "0" / "0"
User CTCSS         : settings.defaultUserCtcss (default 12)
Tx Power           : settings.defaultPower ("Low"/"Medium"/"High", default "Medium")
Skip               : skip_raw==="S" || (settings.skipLinks && type∈{Link,Hotspot}) → "Skip" annars "Scan"
Step               : settings.defaultStep (default "12.5 kHz")
Clock Shift        : "N"
Memory Group       : "N"
Comment            : c.comment
```

Ledande kolumn (utan namn): index 1..N per fil.

```text
id: "rt-systems-yaesu-generic"
label: "RT Systems Yaesu ???"
vendor: "RT Systems"
filenameBase: "rt-systems-yaesu"
limits.maxNameLength: 16
limits.supportedSignalModes: ["FM","C4FM"]
limits.supportsSplit / Ctcss / Dcs: true
resolveMaxNameLength: s => s.maxLength
exportMany: buildSplitFiles
```

Registreras i `targets/index.ts`. Lägg ny entry i `useCodeplugDownload.invokeTarget`-switchen.

### 9. Warning-koder

Nya: `rt_unsupported_mode` (vid fallback FM), eventuellt `rt_name_truncated`. Läggs till i `WarningCode`-unionen.

## Tester

- `__tests__/modes.test.ts` — `parseModes("FM / C4FM")`, alias (`"D-Star"`, `"DSTAR"`, `"YSF"`).
- `__tests__/pipeline.test.ts` — utökad: rad med `mode_raw="FM / C4FM"` och `filter.modes=["FM","C4FM"]` ger två kanaler med olika `mode_effective`; `modes=["FM"]` ger en kanal.
- `__tests__/naming.test.ts` — `{mode}`-token → `"GBG-FM"`, `"GBG-C4FM"`.
- `__tests__/targets/rt-systems-yaesu.test.ts` — header byte-för-byte, FM-rad → `Operating Mode=FM`, C4FM-rad → `Operating Mode=DN`, Tone Mode-mappning, simplex vs duplex offset.
- Migrationssmak: `filter.modeStrategy="exact_fm"` läses som `modes=["FM"]`.

UI-disablingen testas inte i denna omgång (visuell, enkel).

## Filer

- `src/lib/codeplug/modes.ts` (ny)
- `src/lib/codeplug/models.ts`
- `src/lib/codeplug/defaults.ts`
- `src/lib/codeplug/pipeline.ts`
- `src/lib/codeplug/filters.ts`
- `src/lib/codeplug/naming.ts`
- `src/lib/codeplug/targets/types.ts` (lägg `supportedSignalModes`)
- `src/lib/codeplug/targets/chirp-generic.ts`, `vgc-n76.ts`, `nicsure-rt880.ts` (deklarera stödda modes)
- `src/lib/codeplug/targets/rt-systems-yaesu.ts` (ny)
- `src/lib/codeplug/targets/index.ts`
- `src/components/codeplug/RepeaterFilterPanel.tsx`
- `src/components/codeplug/NamingEditor.tsx`
- `src/hooks/useCodeplugDownload.ts`
- Tester ovan

## Beslut jag tar utan att fråga

- C4FM mappas till RT Systems `Operating Mode = "DN"` (digital narrow / System Fusion). `AMS` default "N".
- Om en mode markeras i filtret men inte stöds av aktivt target: kanalen exporteras med fallback (FM) + warning. Vi nollar inte användarens val automatiskt vid target-byte.
- Mode-aliasen `YSF`/`DN` mappas till `C4FM` så framtida RT Systems-input kan parsas utan extra logik.
