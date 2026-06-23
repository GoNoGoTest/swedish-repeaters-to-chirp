## Mål

Två justeringar av statistikpanelen i Förhandsgranska & exportera:

1. Långa etiketter ("Namnkollisioner", "Frekvensdubbletter") bryter inte radigt och blir avhuggna. Fixa radbrytning.
2. Klick på en stat-ruta filtrerar preview-tabellen till bara de raderna. **Exporten påverkas inte** — den jobbar fortfarande mot hela `exportChannels`.

## 1. Radbrytning i Stat-rutorna

`src/components/codeplug/common.tsx` — i `Stat`-komponenten lägger jag till `break-words leading-tight` på label-`div`:en. Det tvingar långa ord att brytas inom rutans bredd istället för att overflowa (det är ingen `truncate`/`overflow-hidden` — orden bryts helt enkelt inte i default-CSS utan `overflow-wrap: anywhere`/`break-words`).

## 2. Klickbara stat-rutor som filtrerar previewn

### State

I `src/routes/index.tsx`:

```ts
type StatFilter = "warned" | "collided" | "dupes" | "rxOnly" | null;
const [statFilter, setStatFilter] = useState<StatFilter>(null);
```

Klick på en ruta växlar — klick igen rensar.

### Filtrera previewn

`PreviewTable` får en härledd lista baserat på `statFilter`. Predikat:

- `warned`: `c.warnings.length > 0`
- `collided`: `c.collided`
- `dupes`: `c.warnings.some(w => w.code === "freq_duplicate")` (samma logik som i `stats`-räknaren)
- `rxOnly`: `c.rx_only`

```ts
const previewChannels = useMemo(() => {
  if (!pipeline) return [] as NormalizedChannel[];
  if (!statFilter) return pipeline.channels;
  return pipeline.channels.filter(predicate[statFilter]);
}, [pipeline, statFilter]);
```

`PreviewTable channels={previewChannels}` istället för `pipeline.channels`. **`exportChannels` rörs inte** — exporten och knappen "Exportera (N)" fortsätter använda hela filtrerade settet.

### Gör Stat klickbar

`Stat` i `common.tsx` får två nya valfria props:
- `onClick?: () => void`
- `active?: boolean`

När `onClick` finns:
- rendera som `<button>` istället för `<div>`, med samma klasser
- `active=true` → kantfärg `border-primary` + svag bakgrundsacccent (`bg-primary/5`)
- hover: `hover:border-primary/60`

Det bevarar tooltip (`title`) och layout. Befintliga icke-klickbara anrop påverkas inte.

### Banner när filter är aktivt

Direkt ovanför `PreviewTable`, när `statFilter != null`, en liten rad:

```
Visar bara <label> (<antal>) · [Visa alla]
```

`[Visa alla]` rensar `statFilter`. Klart att exporten ändå skickar med alla, inte bara dessa.

Fotraden i `PreviewTable` ("Totalt N rader · M exporteras") visar då filtrerade siffran för "Totalt", men "exporteras"-räknaren ska fortsätta visa det riktiga export-antalet. Enklast: skicka in `exportCount={exportChannels.length}` som ny prop till `PreviewTable` och visa "{channels.length} rader visas · {exportCount} exporteras" — så blir det entydigt att exporten inte är filtrerad.

## Filer som ändras

- `src/components/codeplug/common.tsx` — `Stat` får `break-words leading-tight`, valfria `onClick`/`active`.
- `src/routes/index.tsx` — `statFilter`-state, klickhandlers på de fyra varnings-rutorna, härledd `previewChannels`, banner.
- `src/components/codeplug/PreviewTable.tsx` — accepterar `exportCount` och uppdaterar fotraden så det är tydligt att exporten är frikopplad från visningsfiltret.

Inga nya tester (rena UI-tillägg). Befintliga tester rör inte den här koden.
