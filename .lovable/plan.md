# Konsekvent digital-detektion i chirpDigitalWarnings()

Smal följdfix. Byt ut den hårdkodade `DIGITAL_MODES`-setten i `src/lib/codeplug/exporters/chirp.ts` mot `classifyChannel()` från `accessModes.ts`, så att varningslagret använder samma synonymtabell som mode-mappningen.

## Ändring

I `chirpDigitalWarnings()`:

```ts
export function chirpDigitalWarnings(channels: NormalizedChannel[]): Warning[] {
  const has = channels.some((c) => {
    const cls = classifyChannel(c);
    return cls === "dmr" || cls === "c4fm" || cls === "dstar" || cls === "p25";
  });
  if (!has) return [];
  return [
    /* oförändrad varning */
  ];
}
```

Ta bort `DIGITAL_MODES`-konstanten och det oanvända `channelSignalMode`-importet om det blir dött. `classifyChannel` är redan importerad.

`tetra` exkluderas medvetet — CHIRP Generic CSV bär inte Tetra alls och target-limits faller redan tillbaka till analog mode för Tetra-rader; ingen `chirp_digital_partial`-varning behövs då.

## Tester

I `__tests__/exporters/chirp.test.ts`, lägg till i befintlig `describe`:

- Pack-rad med `mode_pack="DN"` → `chirpDigitalWarnings` innehåller `chirp_digital_partial`.
- Pack-rad med `mode_pack="DV"` → samma.
- Pack-rad med `mode_pack="DMR+"` → samma.
- SK6BA-rad med `mode_effective="C4FM"` → samma (regression).
- Helt analog uppsättning (FM/USB) → tom array (regression).

## Verifiering

`bun run verify`. Snapshot-tester ska förbli byte-identiska för analoga targets.
