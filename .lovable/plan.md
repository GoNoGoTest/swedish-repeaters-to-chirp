## Problem

1. **Inte synlig i publicerad app**: Frontend-ändringar går live först när appen publiceras igen. Targetet finns i koden (`src/lib/codeplug/targets/rt-systems-yaesu.ts`, registrerat via `targets/index.ts`) och visas i preview, men `https://se-codeplug.lovable.app` kör en äldre build. Lösning: publicera om efter att namnet är uppdaterat.

2. **Byt namn** från "RT Systems Yaesu ???" → "RT-Systems Yaesu FTM-510".

## Ändringar

**`src/lib/codeplug/targets/rt-systems-yaesu.ts`**
- `label: "RT-Systems Yaesu FTM-510"`
- Uppdatera `description` så "???"/"radiomodell ännu inte fastslagen"-formuleringen ersätts med en kort FTM-510-specifik text (CSV för RT Systems till Yaesu FTM-510, stödjer FM och C4FM/DN).
- `id` behålls som `rt-systems-yaesu-generic` så att sparade inställningar (`settings.export.perTarget[id]`, `targetId`) och migrationslogik fortsätter fungera — id är internt, label är det användaren ser. Filenames (`filenameBase: "rt-systems-yaesu"`) behålls också.

**Inga test- eller pipeline-ändringar**: tester kontrollerar header/fält/mappning, inte label. Inga andra filer refererar till strängen "Yaesu ???".

## Publicering

Efter ändringen: publicera om så att FTM-510-målet syns på `se-codeplug.lovable.app`. Frågar dig innan jag trycker publish.
