## Plan

1. **Åtgärda sannolik grundorsak**
   - `package.json` har `"sideEffects": false`.
   - `src/lib/codeplug/targets/index.ts` förlitar sig på side-effect-importer (`import "./rt-systems-yaesu"`) för registrering.
   - I deployad build verkar Yaesu-modulen tree-shakas bort eftersom den inte används som runtime-värde någon annanstans.

2. **Gör target-registreringen explicit**
   - Ändra `src/lib/codeplug/targets/index.ts` så den importerar varje target som värde och anropar `registerTarget(...)` centralt.
   - Det gör Yaesu-targeten till en faktisk runtime-beroende modul, inte bara en side effect som bundlern kan ta bort.
   - Behåll idempotent registrering så HMR/SSR fortsatt fungerar.

3. **Rensa dubbel-/gammal registreringsmodell vid behov**
   - Om modulerna fortfarande självregistrerar sig längst ned kan vi antingen låta det vara eftersom `registerTarget` är idempotent, eller ta bort självregistreringen för en tydligare modell.
   - Jag väljer minsta säkra ändring: central explicit registrering och lämnar resten oförändrat om det inte orsakar problem.

4. **Verifiera**
   - Kontrollera lokalt att `listTargets()`/UI innehåller `RT-Systems Yaesu FTM-510`.
   - Efter att du klickar Update igen bör både preview och `se-codeplug.lovable.app` visa Yaesu i exportformat-listan.

## Förväntad effekt

Det här adresserar varför Update verkar gå klart men live-sidan inte ändras: källkoden innehåller Yaesu, men deployad bundle laddar inte target-modulen, så publiceringen saknar formatet även när den lyckas.