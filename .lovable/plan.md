## Mål

Punkt 8, inkrementellt: behåll `NormalizedChannel`-formen och alla targets oförändrade, men sluta mutera kanalobjekt mellan pipeline-steg. Samtidigt rensa upp `mode_pack` vs `mode_effective`-dubletten som driver flera av specialfallen i targets.

Inga ändringar i targets, exporters eller UI utöver typimport.

## Del A — Immutabel pipeline

Idag muterar `runPipeline` kanaler in-place i tre olika steg (RX-only-policy, split-validering, naming/kollision). Det tvingar fram defensiv kloning av channel-pack-rader och `warnings: []`-nollställning vid varje körning (rad 260-268). Vi byter ut det mot pure transforms.

### A1. Markera typen som "djupt readonly" i pipeline-scope

I `models.ts`:

```ts
export type NormalizedChannel = {
  /* unchanged shape */
};
export type ReadonlyChannel = Readonly<NormalizedChannel> & {
  readonly warnings: ReadonlyArray<Warning>;
};
```

Pipeline-stegen tar och returnerar `ReadonlyChannel[]`. Targets fortsätter ta `NormalizedChannel[]` (strukturellt kompatibelt — `Readonly<T>` är assignable till `T` i praktiken via en `as`-cast vid pipeline-utgång, eller via en `freezeChannels`/`unfreeze`-helper). Slutresultatet `PipelineResult.channels` exponeras som `NormalizedChannel[]` precis som idag.

### A2. Skriv om de tre muterande stegen som rena transforms

- `applyRxOnlyPolicy`: returnera nya objekt med `{ ...ch, duplex: "off", warnings: [...ch.warnings, w] }` eller `{ ...ch, comment, warnings: [...] }`. Slipper mutera `ch.duplex`/`ch.comment`/`ch.warnings`.
- Split-valideringsloopen (rad 271-278): bygg om till `.map(ch => ch.duplex === "split" && ch.tx_frequency == null ? { ...ch, warnings: [...ch.warnings, w] } : ch)`.
- Naming-loopen (rad 303-309) och collision-loopen (rad 314-319): byt till `.map` som producerar nya objekt med `generated_name_full`, `generated_name_final` och uppdaterad `warnings`. `resolveCollisions` muterar `ch.collided` idag — flytta den mutationen till en ren variant som returnerar `{ channels, unresolved }` eller en `Set<sourceKey>` av kolliderade nycklar som naming-steget konsumerar.

### A3. Ta bort defensiv kloning

När inget steg muterar pack-rader kan `validPacks`-blocket (rad 260-268) ersättas av en ren filter:

```ts
const validPacks = packChannels.filter((c) => c.rx_frequency != null);
```

Inga `warnings: []`/`generated_name_*: ""`-resets behövs, eftersom varje steg skapar nya objekt. Pack-importerns cache påverkas inte längre av en pipeline-körning.

### A4. `expandModes` och `normalize`

`expandModes` använder redan `{ ...c, mode_effective: m, warnings: [...c.warnings] }` — bra. `normalize` skapar nya objekt — bra. Inga ändringar där förutom typsignatur (`ReadonlyChannel`).

### A5. Tester

- Lägg till `pipeline.immutability.test.ts`: kör `runPipeline` två gånger med samma `packChannels`-array. Andra körningen ska ge identiskt resultat (samma warnings-count, samma `generated_name_final`). Ingen ändring av inputens `warnings`/`duplex`/`comment` mellan körningarna (deep-equal pre/post).
- Befintliga pipeline- och target-tester ska fortsätta passera oförändrade (slutoutput är samma form).

## Del B — Samla `mode_pack` + `mode_effective`

Idag har `NormalizedChannel` två lägesfält som betyder olika saker beroende på källa, och flera targets (chirp-generic, vgc-n76, nicsure-rt880) har egen logik för "välj rätt sträng". Vi inför en enda ackessor och låter fälten leva kvar internt utan att exponera dem brett.

### B1. Helper i `modes.ts`

```ts
/** Kanonisk source/signal-mode för en kanal, oavsett källa. */
export function channelSignalMode(c: NormalizedChannel): string {
  return c.source_type === "channel_pack" ? c.mode_pack || "" : c.mode_effective || "";
}
```

`mode_effective` står kvar för SK6BA (sätts av `expandModes`), `mode_pack` står kvar för pack-rader (sätts av pack-importern). Båda blir implementationsdetalj — konsumenter använder `channelSignalMode`.

### B2. Konsumenter

- `PreviewTable` Signal-kolumnen: byt `c.mode_pack || c.mode_effective || "—"` → `channelSignalMode(c) || "—"`.
- `chirp.ts` `resolveChirpMode`, `vgc-n76` och `nicsure-rt880` `previewMode`: använd `channelSignalMode(c)` istället för manuella fallbacks. Beteendet är identiskt.

### B3. Inte i scope nu

- Att slå ihop till ett enda `mode`-fält i `NormalizedChannel` (kräver ändringar i importers + cache-format). Lämnas till en eventuell senare diskriminerad-union-refaktor.
- Att flytta `generated_name_*`/`warnings`/`collided` till en separat `DerivedExportChannel`. Också senare refaktor; täcks indirekt av A:s immutabilitet.

## Acceptanskriterier

- Pipeline-stegen returnerar nya kanalobjekt; ingen `ch.x = ...` kvar i `pipeline.ts` (verifierat med `rg "ch\." src/lib/codeplug/pipeline.ts`).
- Defensiv `validPacks`-kloningen är borta.
- Ny test: två efter-varandra-körningar med samma pack-input ger identiska warnings utan reset, och inputens `warnings`-array är oförändrad.
- `channelSignalMode` används av PreviewTable + de tre target-previews; inga andra beteendeändringar.
- `bun run verify` grön.

## Ej i scope

Punkt 7 (klar), full union-typ för `Channel`, omskrivning av targets, ändringar i pack-importer eller saved-exports.
