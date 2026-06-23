## Problem

`channelKey()` i `src/components/codeplug/PreviewTable.tsx` bygger nyckeln av `source_type:pack_id:source_id:source_row`. När pipelinen expanderar en SK6BA-rad med flera moder (t.ex. FM + C4FM) till flera `NormalizedChannel` får varianterna identisk nyckel. Konsekvenser:

- Att toggla exkludering på FM-raden exkluderar även C4FM-varianten (och tvärtom).
- `exportChannels`-filtret i `src/routes/index.tsx` (rad 165) tar bort båda samtidigt.
- Footern i `PreviewTable` (rad 150) använder fallback `channels.length - excludedKeys.size`, vilket blir matematiskt fel när en nyckel motsvarar flera kanaler.

## Åtgärd

### 1. `src/components/codeplug/PreviewTable.tsx`

Utvidga `channelKey` så den även diskriminerar på mode och RX-frekvens:

```ts
export function channelKey(c: NormalizedChannel): string {
  return [
    c.source_type,
    c.pack_id ?? "",
    c.source_id,
    c.source_row,
    c.mode_effective,
    c.rx_frequency?.toFixed(6) ?? "",
  ].join(":");
}
```

Ändra också footern (rad 150) så fallback inte används när det är missvisande — använd alltid `exportCount` när det finns, annars räkna faktiskt antal icke-exkluderade kanaler via `channels.filter((c) => !excludedKeys.has(channelKey(c))).length` istället för subtraktion. Det blir korrekt även om gamla nycklar råkar ligga kvar i `excludedKeys`.

### 2. Inga ändringar krävs i `src/routes/index.tsx`

`exportChannels` använder redan `channelKey(c)` så filtret blir automatiskt korrekt när nyckeln blir mer specifik. `excludedKeys.size`-visningen på rad 487 är fortfarande sann (antal nycklar användaren togglat).

### 3. Tester

Lägg till ett enhetstest under `src/lib/codeplug/__tests__/` (eller bredvid `PreviewTable`) som verifierar att två kanaler från samma SK6BA-rad med olika `mode_effective` får olika `channelKey`. Befintliga test ska fortsätta gå igenom.

### Edge case: stale excluded keys

När användaren ändrar inställningar så att multi-mode expansionen ändras kan gamla nycklar bli "dangling" i `excludedKeys`. Det är inte värre än tidigare och kräver ingen separat städning i denna fix — `Set.has()` returnerar bara `false` för dem.

## Acceptanskriterier

- Toggla exkludering på FM-varianten av en multi-mode SK6BA-rad påverkar inte C4FM-varianten i previewen eller i export.
- Footern visar korrekt antal exporterade kanaler även när multi-mode-rader är delvis exkluderade.
- `bun run verify` grön.
