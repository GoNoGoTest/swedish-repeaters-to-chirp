## Bekräftade fel mot koden

Jag har gått igenom de sju punkterna mot källkoden. Sex av sju är reella; en (DCS-validering) är mer av en stramning än en bugg. Förslag nedan håller ändringarna smala.

---

### 1. `summarize()` förstår inte `Duplex N` (sk6ba.ts:180–183)

Idag:
```ts
if (!shiftRaw || (parseNumberLoose(shiftRaw) == null && shiftRaw.toLowerCase() !== "simplex")) {
  unclearShift++;
}
```
`Duplex -2`, `Duplex 0`, tom sträng räknas alla som unclear, trots att `parseShift()` numera tolkar dem.

**Fix:** importera `parseShift` från `./frequency` och räkna `unclearShift` som `parseShift(r.tx_shift).unclear`. Tom sträng → `simplex` (`unclear=false`), så summan blir konsistent med pipeline.

Test: utöka `summarize counts categories` med rader `tx_shift: ""`, `"Duplex 0"`, `"Duplex -2"`, `"trams"` → endast den sista räknas som unclear.

---

### 2. `filteredOut` är fel efter mode-expansion (pipeline.ts)

`totalInput = sk6baRows.length + packChannels.length` mäts före expansion, `finalChannels.length` efter. En `FM / C4FM`-rad som expanderas till 2 kanaler ger negativ/missvisande diff.

**Fix:** byt definition till "antal källrader som inte producerade någon utgångskanal":
- För SK6BA: räkna unika `source_row` som finns kvar i `finalChannels` (SK6BA-grenen) → `sk6baRows.length - usedSourceRows.size`.
- För packs: `packChannels.length - finalChannels.filter(c => c.source_type === "channel_pack").length`.
- Summera. Kan inte bli negativ. Behåll fältet på `PipelineResult`.

Test: ny test i `pipeline.test.ts` (eller utöka befintlig): 1 SK6BA-rad med `FM / C4FM`, mode-filter tomt → `filteredOut === 0` även om `channels.length === 2`.

---

### 3. APRS hamnar inte på slot 32 vid <31 användarrader (vgc-n76.ts:377–383)

`insertAprsRow` appenderar APRS när `rows.length < 31`. Settingsbeskrivningen lovar "fast slot 32".

**Fix:** pad-up före insättning så APRS alltid landar på index 31 (slot 32) i icke-chunkade exporter:
```ts
function insertAprsRow(rows, aprs) {
  const SLOT_INDEX = VGC_N76_CHANNELS_PER_GROUP - 1; // 31
  if (rows.length >= SLOT_INDEX) {
    return [...rows.slice(0, SLOT_INDEX), aprs, ...rows.slice(SLOT_INDEX)];
  }
  const padded = [...rows];
  while (padded.length < SLOT_INDEX) padded.push({ ...EMPTY_ROW });
  padded.push(aprs);
  return padded;
}
```
Chunkad export påverkas inte (där cappas userCap till 31 redan).

Test: utöka `vgc-n76.test.ts` — 5 användarrader + `reserveAprsSlot32` → rad index 31 = APRS, rader 5–30 är tomma.
Snapshot under `targets/__snapshots__/` kan behöva uppdateras; jag uppdaterar berörda snapshots.

---

### 4. Tetra listas som stött i CHIRP men mappas till null (chirp-generic.ts + chirp.ts:67)

`supportedSignalModes` innehåller `"Tetra"`, men `mapEffectiveMode("TETRA")` returnerar null och `chirpDigitalWarnings` skippar den.

**Fix:** ta bort `"Tetra"` ur `CHIRP_GENERIC_LIMITS.supportedSignalModes`. Det är den minimala, korrekta ändringen — Tetra hör inte hemma i Generic CSV. Befintlig kommentar i `mapEffectiveMode` förblir korrekt.

Test: liten check i `targets/chirp-generic.test.ts`: `CHIRP_GENERIC_LIMITS.supportedSignalModes` innehåller inte `"Tetra"`.

---

### 5. PreviewTable RX-badge undercountar (PreviewTable.tsx:129)

Pipeline + ExportPanel använder `c.rx_only || !c.tx_allowed`. PreviewTable använder bara `c.rx_only`.

**Fix:** ändra till `(c.rx_only || !c.tx_allowed)`. Ingen pipelineändring.

Test: utöka `PreviewTable.test.tsx` med en pack-rad `rx_only=false, tx_allowed=false` → badge "RX" syns.

---

### 6. Split utan tx_frequency exporterar trasigt (pipeline.ts:255–266, chirp.ts:122–129)

Idag: varning `pack_split_unsupported` läggs men `duplex` lämnas som `"split"`. CHIRP-exporten faller då på `{ duplex: c.duplex, offset: c.offset.toFixed(6) }` → `Duplex=split, Offset=0.000000`, vilket är värre än simplex.

**Fix:** i samma `packValidated.map(...)` där varningen läggs, degradera raden till säker simplex (`duplex: ""`, `offset: 0`) i stället för att bara varna. Behåll varningen så användaren ser nedgraderingen.

```ts
if (ch.duplex === "split" && ch.tx_frequency == null) {
  return {
    ...ch,
    duplex: "",
    offset: 0,
    warnings: [...ch.warnings, { code: "pack_split_unsupported", message: "Split-kanal saknar tx_frequency; exporteras som simplex" }],
  };
}
```

Test: ny test i `pipeline.test.ts` — pack-rad med `duplex="split"`, `tx_frequency=null` → resultatet har `duplex===""` och varning `pack_split_unsupported`.

---

### 7. DCS-validering är för slapp (tones.ts:18–22)

`normalizeDcs` accepterar 0–999 inkl. decimaltal med 8/9. DCS-koder är 3-siffriga oktala värden.

**Fix:** stram till `normalizeDcs` så icke-oktala värden förkastas:
```ts
function normalizeDcs(raw) {
  const n = typeof raw === "number" ? raw : parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 777) return null;
  const s = String(n).padStart(3, "0");
  if (!/^[0-7]{3}$/.test(s)) return null; // oktal-only
  return s;
}
```
Detta avvisar t.ex. `DCS 089`, `DCS 800`. Det räcker som första steg utan att slå på en hårdkodad allowlist (kan göras separat senare). Befintliga tester använder `025`, `023`, `054` osv. — alla giltiga oktalt.

Test: i `tones.test.ts` lägg till `parseAccess("DCS 089").dcs === null` och `parseAccess("DCS 800").dcs === null`. Verifiera att befintliga DCS-tester fortfarande passerar.

---

## Genomförandeordning

1. summarize-fix + test
2. filteredOut + test
3. VGC APRS pad-up + test (uppdatera ev. snapshots)
4. Ta bort Tetra ur CHIRP supportedSignalModes + test
5. PreviewTable RX-badge + test
6. Split-degradering i pipeline + test
7. DCS oktal-validering + test
8. `bun run verify`

Inga modeller, exportkontrakt eller filstrukturer ändras. Bredden förblir smal.
