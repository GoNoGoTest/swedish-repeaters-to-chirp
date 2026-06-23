## Mål

Ersätt de fyra varnings-räknarna i Repeater-sektionens stat-rad med tre handlingsbara siffror som speglar vad användaren faktiskt får ut av exporten.

## Ny stat-rad

I `src/routes/index.tsx` (rad 203–210), ersätt nuvarande grid med tre rutor:

```
Rader i import · Kanaler i export · Bortfiltrerade (med tooltip)
```

- **Rader i import** = `summary.totalRows` — antal rader i CSV:n.
- **Kanaler i export** = `pipeline.channels.length` (eller `exportChannels.length`, se nedan) — det som faktiskt skrivs till radion efter filter, mode-expansion, dedupe och ev. manuell exkludering i previewn.
- **Bortfiltrerade** = `Rader i import − Kanaler i export`, med tooltip som visar övergripande kategorier.

Distrikt-räknaren tas också bort eftersom den inte var en av de tre du valde.

Gridden ändras från `lg:grid-cols-6` till `lg:grid-cols-3`.

## Vilken siffra används för "Kanaler i export"

Två rimliga tolkningar:

- **`pipeline.channels.length`** — antal kanaler efter filter/dedupe/namngivning, oberoende av om användaren manuellt klickat bort rader i previewn.
- **`exportChannels.length`** — efter manuell exkludering också (det som faktiskt hamnar i den nedladdade filen).

Jag använder `exportChannels.length`, så siffran följer med när användaren bockar av rader i previewn. Det matchar vad knappen "Ladda ner" producerar. Bortfiltrerade = `summary.totalRows − exportChannels.length` blir då sant för "allt som inte är med i nedladdningen".

## Tooltip för "Bortfiltrerade"

Övergripande kategorier baserat på pipelinens räknare och tillgänglig data:

- **Saknar RX-frekvens** — antal rader där `rx_frequency == null` (kan inte programmeras alls).
- **Bortfiltrerade av filter** — rader som föll bort i `applyFilters` / mode-expansion. Beräknas som mellanskillnaden: `(rader med RX) − (kanaler efter filter och mode-expansion)`. Slår samman band/status/distrikt/läge i en enda post — matchar ditt val "övergripande kategorier".
- **Frekvensdubbletter borttagna** — `pipeline.totalInput − pipeline.channels.length − övriga`-bidraget från `applyFreqDedupe` (rader som droppats av drop_pack/drop_sk6ba-policy).
- **Manuellt exkluderade** — `excludedKeys.size`, om > 0.

Bara icke-noll-rader visas i tooltipen. Den första raden är en kort sammanfattning, t.ex.:

```
124 av 312 rader hamnar inte i exporten

• Saknar RX-frekvens: 4
• Bortfiltrerade av filter: 108
• Frekvensdubbletter: 9
• Manuellt exkluderade: 3
```

## Tekniska detaljer

1. **Stat-komponenten** (`src/components/codeplug/common.tsx`) får en valfri `tooltip?: ReactNode`-prop. När den sätts wrappas rutan med shadcn `Tooltip` + `TooltipTrigger`/`TooltipContent`. Befintliga anrop påverkas inte.

2. **Beräkning** sker i `src/routes/index.tsx` i en `useMemo` som tar `summary`, `pipeline` och `exportChannels`. För att räkna "bortfiltrerade av filter" behöver vi veta hur många som hade RX innan filter. Jag exponerar det enklast genom att utöka `PipelineResult` med ett par fält:

   - `withRx: number` — `normalized.filter(c => c.rx_frequency != null).length` (SK6BA, innan filter/mode-expansion).
   - `droppedByDedupe: number` — `dedupe.dropped.length`.

   Det är två rena tilläggsfält i `pipeline.ts`; inga befintliga konsumenter rörs.

3. **Tester** (`src/lib/codeplug/__tests__/pipeline.test.ts`) — lägg till ett litet test som verifierar att `withRx` och `droppedByDedupe` rapporteras korrekt för en fixture med en saknad RX och en pack-vs-sk6ba-dubblett under `drop_pack`-policy.

4. **Ingen ändring** i `pipeline.ts`-logik utöver de två räknarna, och inga tester som rör befintliga räknare ändras.

## Filer som ändras

- `src/routes/index.tsx` — ny stat-rad, beräkning av tooltip-data.
- `src/components/codeplug/common.tsx` — `Stat` accepterar `tooltip`.
- `src/lib/codeplug/pipeline.ts` — `withRx`, `droppedByDedupe` läggs till `PipelineResult`.
- `src/lib/codeplug/__tests__/pipeline.test.ts` — ett nytt test för räknarna.
