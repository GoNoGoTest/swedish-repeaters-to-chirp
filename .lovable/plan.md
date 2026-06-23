## Mål

`HardwareLimits.supportedSignalModes` används idag bara för att gråa ut mode-toggles i UI:t (`RepeaterFilterPanel`). Det stoppar inte digitala SK6BA-rader om användaren ändå kryssar i C4FM/DMR i filtret, eller om kanalpaket bär digitala mode-värden. För analog-only-mål (VGC N76, Nicsure RT-880) ska digitala SK6BA-varianter filtreras bort i exportsteget med en tydlig varning, medan kanalpaketens `mode_chirp` (AM/FM/NFM) fortsatt går igenom.

## Ändringar

### 1. `src/lib/codeplug/targets/vgc-n76.ts`

Lägg till en privat helper:

```ts
function filterAnalogFmSk6ba(channels: NormalizedChannel[]): {
  kept: NormalizedChannel[];
  droppedCount: number;
} {
  const kept: NormalizedChannel[] = [];
  let droppedCount = 0;
  for (const c of channels) {
    if (c.source_type === "sk6ba" && c.mode_effective !== "" && c.mode_effective !== "FM") {
      droppedCount++;
      continue;
    }
    kept.push(c);
  }
  return { kept, droppedCount };
}
```

Kör den i `toVgcN76Rows` (innan `channels.map`). Pusha en `Warning` med kod `vgc_digital_sk6ba_skipped`:

> "N kanal(er) från SK6BA hoppades över: VGC N76 stöder bara analog FM, digitala mode (C4FM/D-Star/DMR/DMRplus/P25) går inte att skriva i app-CSV:n."

Kanalpaket (`source_type === "channel_pack"`) påverkas inte — `mode_chirp=AM/FM/NFM` fortsätter exporteras via befintlig `encodeBandwidth` / `isAm`.

`exportVgcN76Csv` använder redan `toVgcN76Rows`, så filter och varning når både single-fil och `exportMany` (varje chunk filtreras separat — det är OK eftersom `buildSplitFiles` redan splittar på den filtrerade datan ovanifrån; det dubbla skyddet säkerställer korrekt output även för direkta `toVgcN76Rows`-anrop i tester).

### 2. `src/lib/codeplug/targets/nicsure-rt880.ts`

Samma mönster i `toNicsureRows`:

```ts
function filterAnalogFmSk6ba(...) { /* identical */ }
```

Varningskod `nicsure_digital_sk6ba_skipped`:

> "N kanal(er) från SK6BA hoppades över: RT-880 stöder bara analog FM, digitala mode (C4FM/D-Star/DMR/DMRplus/P25) går inte att skriva i Nicsure-CSV:n."

`Channel_Num`-numreringen baseras på den filtrerade listans index, vilket är önskvärt (inga "hål" i numreringen).

### 3. `src/lib/codeplug/models.ts`

Lägg till `"vgc_digital_sk6ba_skipped"` och `"nicsure_digital_sk6ba_skipped"` i `WarningCode`-unionen.

### 4. Tester

**`src/lib/codeplug/__tests__/targets/vgc-n76.test.ts`**
- Mixed-mode SK6BA: simulera `expandModes`-utdata med två rader (samma source) `mode_effective="FM"` + `mode_effective="C4FM"`. Exporten ska ha 1 datarad (FM-raden), och `warnings` ska innehålla `vgc_digital_sk6ba_skipped` med "1 kanal".
- Pack-rad med `source_type="channel_pack"` och `mode_chirp="AM"` ska komma med (rx_mod=1, tx_mod=1, bandwidth=25000) även om `mode_effective` är tom/digital.
- Pack-rad med `mode_chirp="NFM"` → bandwidth=12500, rx_mod=0.

**`src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`**
- Mixed-mode SK6BA: bara FM-raden exporteras, varning `nicsure_digital_sk6ba_skipped` med "1 kanal".
- Pack med `mode_chirp="AM"` → `Modulation="AM"`, `Bandwidth="Wide"`.

Använd befintliga test-helpers (`makeChannel` om den finns under `__tests__/helpers.ts`, annars konstruera literaler som befintliga test-fall).

## Icke-ändringar

- `supportedSignalModes` på targets förändras inte — UI-gatingen fortsätter fungera. SK6BA-rader filtreras i `expandModes` när användaren har bockat ur digitala modes i filtret; den nya logiken är en defensiv sista barriär för fallet då filtret ändå släpper igenom digitalt (t.ex. via tomt `filter.modes`).
- CHIRP-target och RT Systems Yaesu rörs inte.
- Pipeline och `filters.ts` rörs inte.
