Kör #1–4 i `src/routes/index.tsx`:

**#1 Säker CSV-escaping i `exportReport`** — använd `Papa.unparse` med kolumnordning `["source_type","source_row","source_id","pack_id","name","warnings"]` istället för manuell strängbyggnad. Hanterar komman och citattecken korrekt.

**#2 Ersätt `alert()` med inline-banner** — ta bort `alert(...)` i `doExport`. Lägg en röd banner ovanför Exportera-knappen i preview-sektionen som visas när `pipeline.duplicateStop === true`: text "Export stoppad — frekvensdubbletter enligt policy. Ändra policy eller åtgärda dubbletter." `doExport` blir bara `if (!pipeline || pipeline.duplicateStop) return;`. Disable också Exportera-knappen (`disabled` + `opacity-50 cursor-not-allowed`) när stoppen är aktiv.

**#3 Migration: nollställ legacy-fält i localStorage** — utvidga destructuring i `loadStoredSettings`: `const { maxLength: _dropLegacyMax, ...namingClean } = parsed?.naming ?? {};` och använd `namingClean` när naming spreadas. `legacyMax`-fallbacken till `chirp.maxLength` behålls. Resultat: vid nästa persist-skrivning försvinner `naming.maxLength` och `chirp.cToneFreq` ur localStorage.

**#4 Splittra `pipeline`-useMemo-deps** — ändra dep-array från `[rows, settings, selectedPackChannels]` till de fält som faktiskt påverkar pipeline: `[rows, selectedPackChannels, settings.filter, settings.naming, settings.packs, settings.sort, settings.chirp]`. Wrappar också `enabledPackCount` i `useMemo` på `settings.packs.selection`.

Inga API-ändringar, inga nya filer, inga tester ska påverkas. Kör vitest efteråt för regression.
