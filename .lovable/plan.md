## Mål

Fixa att RT-systems-Yaesu inte renderar `validate()`-varningar i "Förhandsgranska & exportera", och gör switchen exhaustive så framtida target inte kan glömmas.

## Ändringar

**`src/routes/index.tsx`** — switchen runt `target.validate?.(...)`:

1. Lägg till `case "rt-systems-yaesu-generic":` som anropar `target.validate?.(exportChannels, resolveTargetSettings(target, storedPatch))` precis som de övriga tre.
2. Lägg till en `default`-gren som anropar en delad `assertNever(target)`-helper så att kompilatorn flaggar om ett nytt target läggs till i registret utan att hanteras här.

**`src/lib/codeplug/assertNever.ts`** (ny, liten hjälpfil):

```ts
// Tvingar TypeScript att verifiera exhaustivitet i switch/if-kedjor över
// diskriminerade unioner. Anropas i default-grenen — om en variant glöms
// kvar blir argumentet inte `never` och bygget fel.
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

3. Samma exhaustivitets-mönster appliceras på den parallella `resolveMaxNameLength`-switchen längre upp i samma fil (idag täcker den alla fyra men har ingen `default`, så nästa nya target slipper igenom där också).

## Acceptanskriterier

- När `targetId === "rt-systems-yaesu-generic"` och `exportChannels` triggar t.ex. namn-trunkering syns varningarna i den gula listan ovanför preview-tabellen, identiskt med CHIRP/VGC/Nicsure.
- Att lägga till ett nytt target-id i `targets/registry.ts` ger ett tsc-fel i `src/routes/index.tsx` tills båda switcharna utökas.
- `bun run verify` är grön.

## Out of scope

- Inga ändringar i target-registret eller i `rt-systems-yaesu.ts` `validate()`-implementationen.
- Inga UI-ändringar utöver att RT-systems-varningar nu renderas i samma ruta.
