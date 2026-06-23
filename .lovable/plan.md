## Refaktorisering: `mode_chirp` → `mode_pack`

Fältet är felnamngett — det används av CHIRP, VGC N76 och NiCSURE RT-880 och representerar pack-radens ursprungliga mode, inte en CHIRP-specifik egenskap.

### Ändringar

Ren symbolbyte, ingen logikförändring. Sök/ersätt `mode_chirp` → `mode_pack` i:

**Källa**
- `src/lib/codeplug/models.ts` — fältdefinition + JSDoc-kommentaren på `mode_effective` (uppdatera kommentar: "suggested CHIRP Mode for pack rows" → "pack row's original mode (NFM/FM/AM/USB/CW), used by CHIRP, VGC N76 and NiCSURE RT-880 exports").
- `src/lib/codeplug/pipeline.ts` — default-init i `emptyPackFields()`.
- `src/lib/codeplug/importers/channel_pack.ts` — write-site (rad 158).
- `src/lib/codeplug/exporters/chirp.ts` — `resolveMode()` (rad 41).
- `src/lib/codeplug/targets/vgc-n76.ts` — `isAm`, `encodeBandwidth`, rad-encoding + dokkommentar.
- `src/lib/codeplug/targets/nicsure-rt880.ts` — `encodeBandwidth`, `encodeModulation`.
- `src/components/codeplug/PreviewTable.tsx` — pack-mode fallback.
- `src/components/codeplug/NamingEditor.tsx` — mock-default.

**Tester (uppdatera fältnamn och beskrivande testtitlar)**
- `src/lib/codeplug/__tests__/helpers.ts`
- `src/lib/codeplug/__tests__/exporters/chirp.test.ts`
- `src/lib/codeplug/__tests__/targets/vgc-n76.test.ts`
- `src/lib/codeplug/__tests__/targets/nicsure-rt880.test.ts`

### Inte i scope

- Inga ändringar i pack-CSV:ns kolumnnamn (`mode` förblir `mode`).
- Ingen ändring av fallback-logiken eller varningar.
- Inga UI-strängar (svenska texter) påverkas.

### Verifiering

Kör `bunx vitest run` — alla befintliga tester ska passera med endast namnbytet.
