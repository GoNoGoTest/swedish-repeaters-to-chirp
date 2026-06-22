## Justera RT Systems Yaesu-exporten

Tre fynd verifierade mot referensfilen `2026-06-21.csv` (1 header + 999 datarader). Alla ändringar sker i `src/lib/codeplug/targets/rt-systems-yaesu.ts` plus nya testfall.

### 1. DN-kanaler får aldrig analog ton

Om Operating Mode resolvas till `DN` ska `Tone Mode` tvingas till `None`. CTCSS/DCS-fälten behåller sina default-placeholders (`100.0` / `023`). FM-rader påverkas inte.

Implementation: flytta `operatingMode(c)`-anropet före `resolveTone(...)` i `toRtSystemsYaesuRow` och skicka in `mode` till `resolveTone`. När `mode === "DN"` returneras `{ toneMode: "None", ctcss: "100.0", dcs: "023" }` direkt.

### 2. Heltals-MHz-offset skrivs som `X.00000 MHz`

`formatOffsetKhz(2)` ska returnera `"2.00000 MHz"` istället för `"2 MHz"`. Sub-MHz fortsätter formateras i kHz utan decimaler (`"600 kHz"`). 7.6 MHz är fortfarande `"7600 kHz"` som idag (referensen visar inga icke-heltals-MHz, så kHz-fallback är säkrast).

Ny logik:
- `offsetMhz >= 1 && Number.isInteger(offsetMhz)` → `${offsetMhz.toFixed(5)} MHz` (t.ex. `"2.00000 MHz"`, `"5.00000 MHz"`)
- annars `${khz} kHz` som idag

### 3. Padda till 999 rader som default

Lägg till nytt fält i `RtSystemsYaesuSettings`:

```ts
/** Pad output to this many channel rows (header excluded). Empty rows
 *  keep the leading index and all 21 columns. Set to 0 to disable. */
padToRows: number;
```

Default `padToRows: 999`. Tomma rader byggs som:

```
String(index), "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""
```

— alltså löpnummer + 20 tomma fält (matchar headerns 21 kolumner och paddningsraderna i referensen). Inga warnings emiteras för paddningsrader (de räknas inte mot `truncCount`/`unsupportedCount`).

`exportRtSystemsYaesuCsv` itererar `channels`, sedan om `channels.length < s.padToRows` läggs `padToRows - channels.length` tomma rader till med fortsatt löpnummer från `s.startNumber + channels.length`.

### Splitfiler

`buildSplitFiles` kallar `exportRtSystemsYaesuCsv(chunk, s)` per chunk. Paddningen ska appliceras per chunk så varje delfil också blir 999 rader — det matchar förväntan att en split-fil ska kunna importeras stand-alone i RT Systems-mjukvaran.

### UI

Lägg till en numerisk input för `padToRows` i target-settings-panelen (samma plats som övriga RT Systems-fält). Värde `0` = ingen padding. Min `0`, max `999` (radions kapacitet enligt referensen). Detta är en liten UI-tillägg i den befintliga settings-formen — ingen ny komponent.

### Tester (`src/lib/codeplug/__tests__/targets/rt-systems-yaesu.test.ts`)

Nya cases:
- DN-kanal med `ctcss_tx` satt → `Tone Mode === "None"`, `CTCSS === "100.0"`.
- FM-kanal med `ctcss_tx` satt → fortsatt `Tone Mode === "Tone"` (regression).
- 2 MHz offset → `fields[3] === "2.00000 MHz"`.
- 5 MHz offset → `fields[5] === "5.00000 MHz"`.
- 0.6 MHz → fortsatt `"600 kHz"` (regression).
- Export med `padToRows: 999` av lista på 3 kanaler → CSV har 1 header + 999 rader; rad 4 = `"4,,,,,,,,,,,,,,,,,,,,"`; sista raden börjar med `"999,"`.
- `padToRows: 0` → ingen padding.

### Out of scope

- Inga ändringar i andra targets.
- Ingen ändring av default `startNumber`, `defaultPower` etc.
- Ingen ändring av tone-logik för FM (T Sql-vs-Tone-heuristiken är oförändrad).