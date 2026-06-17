# Typad targets-registry — nästa steg

Mål: ta bort de kvarvarande typkompromisserna runt `ExportTarget` utan att ändra runtime-beteende eller datalagring. Konkret de tre platserna idag:

1. `registry.ts` lagrar och returnerar `ExportTarget<any>`.
2. `routes/index.tsx` + `useCodeplugDownload.ts` castar en gång till `ExportTarget<Record<string, unknown>>`.
3. `ExportPanel.tsx` castar `targetSettings as unknown as VgcN76Settings` när VGC-panelen renderas.

Tester och export ska vara oförändrade. Inga ändringar i `chirp-generic`/`vgc-n76`-exporters, `split.ts`, eller persisterad form av `Settings.export.perTarget` (fortsatt `Record<string, unknown>`).

## Designidé

Inför en sluten id → settings-typ-map och låt `requireTarget` returnera en **diskriminerad union** av konkreta `ExportTarget<T>`. Då kan TypeScript narrowa via `target.id === "vgc-n76"` istället för att castas.

### Ny typdeklaration (i `src/lib/codeplug/targets/index.ts`)

```ts
import type { ChirpSettings } from "../models";
import type { VgcN76Settings } from "./vgc-n76";

export interface TargetSettingsMap {
  "chirp-generic": ChirpSettings;
  "vgc-n76": VgcN76Settings;
}

export type TargetId = keyof TargetSettingsMap;

export type AnyExportTarget = {
  [K in TargetId]: ExportTarget<TargetSettingsMap[K]> & { id: K };
}[TargetId];
```

### Registry-ändringar (`registry.ts`)

- Internt får mappen behålla en bredare typ (`ExportTarget<unknown>`), men de publika signaturerna blir:
  - `registerTarget<K extends TargetId>(t: ExportTarget<TargetSettingsMap[K]> & { id: K }): void`
  - `getTarget(id: string): AnyExportTarget | undefined`
  - `requireTarget(id: string): AnyExportTarget`
  - `listTargets(): AnyExportTarget[]`
- En enda välkommenterad intern cast vid `Map.get → AnyExportTarget` ersätter alla nuvarande call-site-castar. Den motiveras med att `registerTarget` är den enda vägen in och att registreringsraderna i `chirp-generic.ts`/`vgc-n76.ts` är typade.

### Call sites

- `routes/index.tsx`:
  - `requireTarget(...)` returnerar nu `AnyExportTarget` direkt. Ta bort `as ExportTarget<Record<string, unknown>>` och TODO-kommentaren.
  - `chirpSettings`-användningen i preview/table avgörs redan av `target.id === "chirp-generic"`-checken — narrowa via en `if (target.id === "chirp-generic") { … target.defaultSettings as ChirpSettings-form … }` lokalt vid behov, eller plocka chirp-settings via en liten helper `getTargetSettings(target, perTarget)` (se nedan).
  - `target.validate`/`resolveMaxNameLength`/`exportMany`-anropen får korrekt `TSettings` via narrowing och behöver inga castar.

- `useCodeplugDownload.ts`:
  - Använder `AnyExportTarget` och narrowa med `switch (target.id)` eller en liten generisk hjälpare:
    ```ts
    function callTarget<T extends AnyExportTarget>(target: T, stored: Record<string, unknown>) {
      const settings = { ...(target.defaultSettings as object), ...stored } as Parameters<T["export"]>[1];
      return settings;
    }
    ```
    Ett enda lokalt cast (`as Parameters<T["export"]>[1]`) ersätter dagens `as Record<string, unknown>`-narrowing över hela hooken.

- `ExportPanel.tsx`:
  - Tar emot `target: AnyExportTarget` (eller importerar och kallar `requireTarget` lokalt med samma `targetId`).
  - I VGC-grenen: `if (target.id === "vgc-n76") { const s = { ...target.defaultSettings, ...(targetSettings as Partial<VgcN76Settings>) }; … }` — den enda kvarvarande casten är ett tydligt avgränsat `Partial<VgcN76Settings>` på den persisterade patch-strukturen, inte längre `as unknown as VgcN76Settings`.
  - Samma mönster för CHIRP-grenen.

### Hjälpare (valfritt, om det blir tydligare)

En liten funktion i `targets/index.ts`:

```ts
export function resolveTargetSettings<T extends AnyExportTarget>(
  target: T,
  stored: Record<string, unknown> | undefined,
): T["defaultSettings"] {
  return { ...(target.defaultSettings as object), ...(stored ?? {}) } as T["defaultSettings"];
}
```

Då kan både `useCodeplugDownload`, `routes/index.tsx` och `ExportPanel` använda samma helper och slippa upprepa cast-formen.

## Vad förändras inte

- `Settings.export.targetId` förblir `string` i `models.ts` (lagrad form). Ingen migrering.
- `Settings.export.perTarget` förblir `Record<string, Record<string, unknown>>`-aktig — typningen sker först när vi parar ihop id med target.
- Inga ändringar i exporters, split-logik, eller exporterad CSV.
- Tester rör vi inte (de använder redan konkreta targets).

## Verifiering

- `bun run test` — alla 175 vitest-tester ska passera.
- `bun run build` — TypeScript-strict ska gå igenom utan nya fel.
- Manuell rök-test i preview: byt mellan CHIRP- och VGC-target i UI, ändra inställningar, exportera. Förväntad output identisk med innan.

## Risker / öppna frågor

- `AnyExportTarget` är en sluten union — att lägga till en ny target kräver att man uppdaterar `TargetSettingsMap`. Det är poängen (kompilatorn fångar glömda inställningstyper), men värt att nämna i en kort kommentar ovanför mappen.
- Om det dyker upp någon annan plats som idag förlitar sig på `ExportTarget<any>` (t.ex. test-helpers) kan en liten justering behövas — i så fall lägger jag den i samma PR.
