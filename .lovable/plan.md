Smal validering av `settings.export.targetId` mot target-registret i `loadStoredSettings`. Om persistat id pekar på en target som inte längre finns registrerad, faller vi tillbaka på `DEFAULT_SETTINGS.export.targetId`. Övrig state (filter, naming, packs, sort, perTarget-block) bevaras.

## Ändring

**`src/hooks/useCodeplugSettings.ts`**
- Importera `getTarget` från `@/lib/codeplug/targets`.
- I `loadStoredSettings`, ersätt `targetId: parsed?.export?.targetId ?? DEFAULT_SETTINGS.export.targetId` med en variant som kontrollerar att `getTarget(storedTargetId)` returnerar något, annars defaultar.

Inga andra filer. Inga tester behöver röras (befintliga tester rör inte denna kodväg; vi behåller offentlig API).