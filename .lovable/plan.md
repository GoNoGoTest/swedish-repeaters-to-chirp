## Mål

Förhandsgranskningen visar idag de första 300 raderna. Användaren vill:
1. Se **alla** rader i previewen.
2. Ha en **toggle längst till vänster** per rad ("exkludera från export") som tar bort raden från exporten utan att den filtreras bort från previewen.

## Designval

- **State i routens komponent**: `excludedKeys: Set<string>` (`useState`). Inga prefs i settings/localStorage i v1 — håll det enkelt och sessionsbaserat (lätt att utöka senare).
- **Stabil rad-nyckel**: `${source_type}:${pack_id ?? ""}:${source_id}:${source_row}`. Behåller exkluderingar även när pipelinen kör om (samma SK6BA/pack-rad → samma nyckel).
- **Single source of truth**: filtrera `pipeline.channels` → `exportChannels` i en `useMemo`. Allt nedströms (export, exportMany, validate-varningar, stats, antal-badge i export-knappen, varningsrapport) använder `exportChannels`. Previewen får hela `pipeline.channels` plus `excludedKeys`.

## Ändringar i `src/routes/index.tsx`

1. **Ny hjälpare** `channelKey(c)` ovanför komponenten.
2. **State**: `const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set())`.
3. **`exportChannels` useMemo**: `pipeline.channels.filter(c => !excludedKeys.has(channelKey(c)))`.
4. **Byt ut `pipeline.channels` mot `exportChannels`** i:
   - `doExport` (både `exportMany` och `export`)
   - `exportReport`
   - `target.validate` (raderna 394-402)
   - Export-knappens antal (rad 378)
   - `stats` useMemo (rad 204-214) — så användaren ser hur många varningar/kollisioner/dupes som finns i det som faktiskt exporteras
5. **Lägg till en liten "exkluderat"-räknare** intill stats: `Exkluderade: N` om `excludedKeys.size > 0`, med en "Återställ"-knapp.

## Ändringar i `PreviewTable`

1. **Ta bort 300-radskapet** — rendera alla rader. Behåll `overflow-x-auto`; lägg till `max-h-[70vh] overflow-y-auto` på wrappern så långa listor inte tar över sidan. Sticky-header (`sticky top-0 z-10`) på `<thead>` för läsbarhet.
2. **Nya props**: `excludedKeys: Set<string>`, `onToggleExclude: (key: string) => void`.
3. **Ny leftmost-kolumn** med rubrik "Exkl." och en `<Switch>` (shadcn `src/components/ui/switch.tsx` — redan tillgänglig) per rad. `aria-label="Exkludera rad N från export"`.
4. **Exkluderade rader**: `opacity-40 line-through decoration-muted-foreground/50`; behåll övrig styling. Räcker visuellt utan att dölja innehåll.
5. Ta bort "Visar X av Y rader. Exporten innehåller alla."-fotnoten (inte längre relevant). Lägg istället till en rad i fotnoten som visar totalt antal rader om listan är lång.

## Tekniska anteckningar

- Toggle-callback skapas en gång via `useCallback`; immutabel `Set`-uppdatering: `new Set(prev)` + add/delete.
- Inget UI behövs för "exportera ändå" — en exkluderad rad syns i previewen men ingår inte i exporten, splittarna, rapporten eller validate-varningarna. Det är hela poängen.
- Inga ändringar i `targets/`, `pipeline.ts` eller `models.ts` — feature är ren UI-state.
- Inga nya tester (ren presentation/state). Befintliga tester påverkas inte.

## Risk

- Renderar man 2000+ rader i en plain table kan det bli segt. Vi tar imellanåt prestandaproblem som dyker upp; ingen virtualisering i v1.
