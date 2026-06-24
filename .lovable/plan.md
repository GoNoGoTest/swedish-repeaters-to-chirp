## Mål

Extrahera target-relaterade deriveringar från `src/routes/index.tsx` till en återanvändbar hook så att route-komponenten orkestrerar UI-state — inte target-specifika switch-satser.

## Problembild i nuvarande `routes/index.tsx`

Fyra närmast identiska `switch (target.id)`-block existerar enbart för TypeScript-narrowing:

1. `maxNameLength` (rad 91–116) — varje case anropar samma `resolveMaxNameLength?.() ?? limits.maxNameLength`.
2. `getExportMode` (rad 187–208) — varje case bygger samma `(c) => target.previewMode?.(c, s) ?? "—"`.
3. target-`validate(...)` i JSX (rad 546–576) — varje case anropar samma `validate?.(channels, s)`.
4. Spridd target-specifik logik: `chirpSettings`-derivering (rad 84–87) och `startLocation`-läsning i `locationByKey` (rad 172).

Plus en target-koppling i `useEffect` (rad 142–148): RT-Systems stödjer inte `block_tx` som RX-only-policy.

## Ny hook: `useActiveExportTarget`

Plats: `src/hooks/useActiveExportTarget.ts`

Signatur:

```ts
function useActiveExportTarget(settings: Settings): {
  target: AnyExportTarget;
  storedPatch: Record<string, unknown> | undefined;
  resolvedSettings: TargetSettingsMap[TargetId]; // narrowed per target internt
  maxNameLength: number;
  previewMode: (c: NormalizedChannel) => string;
  validate: (channels: NormalizedChannel[]) => Warning[];
  previewStartLocation: number; // chirp: startLocation, övriga: 1
  supportsRxOnlyPolicy: (p: RxOnlyPolicy) => boolean;
};
```

### Implementation

En enda intern `switch (target.id)` med `assertNever`-default narrowas target + settings korrekt, sedan exponeras färdiga värden/closures. Inga `as`-casts.

```ts
switch (target.id) {
  case "chirp-generic": {
    const s = resolveTargetSettings(target, storedPatch);
    return buildBundle(target, s, /* previewStart */ s.startLocation);
  }
  case "vgc-n76": { const s = resolveTargetSettings(target, storedPatch); return buildBundle(target, s, 1); }
  case "nicsure-rt880": { ... }
  case "rt-systems-yaesu-generic": { ... }
  default: return assertNever(target);
}
```

`buildBundle` är en intern generic-helper `<T>(target: ExportTarget<T>, s: T, startLoc: number)` som returnerar bundle-objektet — narrowingen sker en gång i switchen, inte fyra.

`supportsRxOnlyPolicy` flyttar RT-Systems-undantaget från `useEffect` in i hooken (en table: `{ "rt-systems-yaesu-generic": p => p !== "block_tx" }`, default `() => true`).

`chirpSettings` försvinner som top-level-derivering i route. Komponenter som idag tar `chirpSettings` (ExportPanel?) får antingen `resolvedSettings` typed via en separat narrowed-accessor eller fortsätter ta `targetSettings: Record<string, unknown>` som idag.

### Memoisering

Hela bundle:n memoas på `[target, storedPatch]`. `previewMode` och `validate` är stabila inom samma bundle.

## Ändringar i `src/routes/index.tsx`

- Ersätt rad 77–116 och 187–208 med `const { target, maxNameLength, previewMode, validate, previewStartLocation, supportsRxOnlyPolicy } = useActiveExportTarget(settings);`
- `locationByKey` läser `previewStartLocation` istället för att switcha på `target.id`.
- JSX-blocket rad 546–576 blir `const tw = validate(exportChannels);`
- `useEffect` rad 142–148 blir `if (!supportsRxOnlyPolicy(settings.packs.rxOnlyPolicy)) { ...skip... }` — fortfarande generiskt, ingen target-namn i route.
- `chirpSettings`-variabeln tas bort från route; `ExportPanel` får fortsatt `targetSettings` (opaque patch) som idag.

Inga ändringar i:

- target-modulerna (`chirp-generic.ts`, `vgc-n76.ts`, ...)
- `registry.ts` / `types.ts`
- pipeline, importers, exporters, models

## Tester

- Ny `src/hooks/__tests__/useActiveExportTarget.test.tsx` med en case per target:
  - Verifierar `maxNameLength`, `previewMode(c)`, `validate(channels)`, `previewStartLocation` matchar direkta anrop mot target API:t.
  - Verifierar `supportsRxOnlyPolicy("block_tx")` är `false` enbart för RT-Systems.
- Befintliga tester (`PreviewTable`, snapshots, target-tester) ska passera oförändrade — hooken är ren refactor av routes/index.tsx.

## Acceptanskriterier

- Inga `switch (target.id)`-block kvar i `routes/index.tsx`.
- `useActiveExportTarget` är enda stället där target-narrowing sker för dessa deriveringar.
- Inga `as any` / `as unknown as`-casts införs.
- `bun run verify` passerar.
- Manuell preview: byt mellan alla fyra targets → samma `maxNameLength`, preview-mode-kolumn, target-warnings, och Loc-numrering som före.

## Utanför scope

- Att splittra `NormalizedChannel`/models vidare.
- Att flytta `ExportPanel`s egna `target.id`-narrowing (panelens sub-panel-routing är en separat refactor).
- IC-705 eller nya targets.
- Ändringar i pipeline/importers/exporters.

## Risker

- `ExportPanel` förväntar sig kanske `chirpSettings` som prop idag — om så är fallet ersätts den i samma patch med `targetSettings`-patchen den redan får (kontrolleras vid implementation; om props-formen är annan, byggs en tunn adapter i route utan target-switch).
- `useEffect`-omskrivningen får inte trigga sig själv i loop — `supportsRxOnlyPolicy` läses som funktion, `useEffect`-deps förblir `[settings.export.targetId]`.
