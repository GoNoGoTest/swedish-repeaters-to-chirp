## Bakgrund

VGC N76 stödjer AM på RX (rx_modulation=1) — exempel-CSV:n och airband-packet visar att kanalerna är AM (mode_chirp="AM"). Idag:

1. `encodeBandwidth()` / row-mapping i `src/lib/codeplug/targets/vgc-n76.ts` behandlar bara `NFM`/`FM`. Alla AM-rader räknas som "unsupported" → varningen "exporterade som NFM" och rx_mod/tx_mod sätts till `0` (FM).
2. `tx_dis` sätts redan korrekt (`c.rx_only || !c.tx_allowed ? "1" : "0"`, rad 220), och importern markerar `rx_only=true` för airband-packet. Default `rxOnlyPolicy="mark"` bevarar flaggan, så detta bör redan fungera — vi verifierar med ett test.

## Ändringar

### `src/lib/codeplug/targets/vgc-n76.ts`

- Lägg till hjälpare `isAm(c)` → `mode_chirp.toUpperCase() === "AM"`.
- `encodeBandwidth()`: AM → `25000` (VGC behandlar AM som wide; airbandskanalsteg 8.33 kHz har inget eget bandwidth-värde).
- I `toVgcN76Rows()`:
  - Sätt `rx_mod = "1"` när AM.
  - Sätt `tx_mod = "1"` när AM (oavsett tx_dis — håller modulering konsekvent ifall användaren slår på TX).
  - Räkna INTE AM som "unsupported" — uppdatera meddelandet till "(USB/CW/DV)".
- `VGC_N76_LIMITS.supportedModes`: lägg till `"AM"`.

### `src/lib/codeplug/__tests__/targets/vgc-n76.test.ts`

Nya tester:
- AM-kanal (mode_chirp="AM", rx_only=true) → `rx_mod="1"`, `tx_mod="1"`, `bandwidth="25000"`, `tx_dis="1"`.
- AM-kanal genererar INGEN `vgc_unsupported_mode`-varning.
- USB-kanal triggar fortfarande varningen (meddelandetext uppdaterad).
- Verifiera tx_dis=1 för en pack-rad med `rx_only=true` via hela pipelinen (default policy="mark") — säkerställer att användarens observation faktiskt är fixad.

## Tekniska anteckningar

- `tx_modulation=1` även för RX-only är medvetet: VGC-appen accepterar det, och om användaren senare slår av `tx_dis` får hen rätt modulering.
- Inget UI-arbete krävs.
- Inga ändringar i `chirp-generic` (CHIRP har redan eget AM-stöd via mode-kolumnen).
