# Smala fixar: access-varningar, CHIRP-mode-mappning, robusthet

Fyra avgränsade ändringar utan bred refaktor.

## 1. Begränsa access-varningar till SK6BA (`pipeline.ts`)

I `applyPostExpansionAccessWarnings()`: lägg till en tidig guard `if (c.source_type !== "sk6ba") return c;` innan analog-varningslogiken körs. Övrig logik (analog-check via `classifyChannel`, `missing_access_tone`, `ctcss_and_dcs`) oförändrad.

Tester i `pipeline.modeSubset.test.ts` (eller `pipeline.test.ts`):

- Analog channel-pack-rad mode=FM/NFM utan tone → ingen `missing_access_tone`.
- SK6BA FM-rad utan access → fortfarande `missing_access_tone`.

## 2. Mappa digitala pack-modes i CHIRP (`exporters/chirp.ts`)

Ändra `resolveChirpMode()`:

```ts
export function resolveChirpMode(c: NormalizedChannel, fallback: string): string {
  if (c.source_type === "channel_pack" && c.mode_pack) {
    const mapped = mapEffectiveMode(c.mode_pack);
    return mapped ?? c.mode_pack;
  }
  const mapped = mapEffectiveMode(c.mode_effective);
  return mapped ?? fallback;
}
```

Utöka `mapEffectiveMode()` med synonymer från pack-input: `DN` → `DN`, `DSTAR`/`D-STAR`/`DV` → `DV`, `DMRplus`/`DMRPLUS`/`DMR+` → `DMR`. Analoga pack-modes (FM, NFM, AM, USB, LSB, CW) returnerar fortfarande `null` så `mode_pack` används som-is.

Viktigt: behåll FM/Tetra som `null` så analog fallback fungerar; för pack-fall där `mode_pack` är `USB/LSB/AM/CW` returneras `mode_pack` direkt (oförändrat beteende).

Tester i `exporters/chirp.test.ts`:

- `mode_pack="C4FM"` → `Mode="DN"`
- `mode_pack="DN"` → `Mode="DN"`
- `mode_pack="DMRPLUS"` → `Mode="DMR"`
- `mode_pack="DMR+"` → `Mode="DMR"`
- `mode_pack="DV"` → `Mode="DV"`
- `mode_pack="USB"` → `Mode="USB"` (oförändrat)

## 3. Trim i `classifyMode()` (`accessModes.ts`)

Ändra `const m = (mode || "").toUpperCase();` → `const m = (mode || "").trim().toUpperCase();`.

Test i `accessModes.test.ts`: `classifyMode(" DMR ") === "dmr"`.

## 4. Diagnostik för ogiltiga digitala tokens (`tones.ts`)

I `parseDigitalAccess()`: när en regex matchar men värdet är ogiltigt (CC utanför 0–15, TS ej 1/2 etc.), lägg hela tokenen i `unknownTokens` istället för att tyst dropa.

Implementation: utöka regex för `TS` så att den fångar `TS\d+` (inte bara `[12]`), validera i handler, push till `unknownTokens` vid invalid. Samma för `CC` (acceptera `\d{1,2}` men validera 0–15). NAC: behåll strikt regex; ogiltiga NAC-fragment fångas naturligt av tokeniseringen.

Tester i `tones.test.ts`:

- `parseDigitalAccess("CC99").unknownTokens` innehåller `"CC99"`, `dmr.colorCode === null`.
- `parseDigitalAccess("TS3").unknownTokens` innehåller `"TS3"`, `dmr.timeSlot === null`.

## Verifiering

Kör `bun run verify`. Snapshot-tester för VGC/NiCSURE/RT Systems Yaesu ska förbli byte-identiska (ingen ändring berör dem). CHIRP-snapshot kan ändras för digitala pack-rader — uppdatera vid behov.
