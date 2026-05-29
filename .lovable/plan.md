## Flytta `maxLength` till global radio-inställning

### Mål
`maxLength` (max kanalnamnslängd) är en hårdvarubegränsning för radions display, inte en egenskap per namnmall. Idag dupliceras den på repeater-naming + varje paket-naming, vilket är förvirrande och lätt att glömma synka. Vi flyttar den till en global inställning i CHIRP-export-sektionen, tillsammans med `mode` och `tStep`.

`cityMaxLength` förblir per namnmall (stilistisk, inte hårdvarurelaterad). Den finns bara i repeater-editorn idag, så ingen ändring där.

### Datamodell (`src/lib/chirp/models.ts`)
- Ta bort `maxLength` från `NamingSettings`.
- Lägg till `maxLength: number` på `ChirpSettings` (default 6).

### Defaults (`src/lib/chirp/defaults.ts`)
- Ta bort `maxLength: 6` från `DEFAULT_REPEATER_NAMING` och `DEFAULT_PACK_NAMING`.
- Lägg till `maxLength: 6` i `DEFAULT_SETTINGS.chirp`.

### Namnlogik (`src/lib/chirp/naming.ts`)
- `buildName(ch, naming, maxLength)` — extra argument istället för att läsa `naming.maxLength`.
- `resolveCollisions(channels, naming, maxLength)` — samma sak; använder `maxLength` för suffix-klippning.

### Pipeline (`src/lib/chirp/pipeline.ts`)
- Skicka in `settings.chirp.maxLength` till alla `buildName`/`resolveCollisions`-anrop, både för SK6BA-rader och paketrader.

### UI (`src/routes/index.tsx`)
- I sektionen där `chirp.mode`, `chirp.tStep`, `chirp.cToneFreq` redan visas: lägg till ett `NumberField` "Max längd kanalnamn" (1–16, default 6) bundet till `settings.chirp.maxLength`.
- Ta bort `maxLength`-fältet ur `NamingEditor` helt (raden försvinner för både repeater och paket).
- `NamingPreview` tar emot `maxLength` som prop (eller läser från ett gemensamt context/state) så previews fortfarande visar korrekt trunkering. Enklast: skicka `maxLength` ner som prop från `Index` → `NamingEditor` → `NamingPreview`.

### Tester
- Uppdatera `src/lib/chirp/__tests__/naming.test.ts` — alla anrop till `buildName`/`resolveCollisions` får ett `maxLength`-argument istället för att sätta `maxLength` i naming-objektet.
- Kör `bunx vitest run` och se att alla 82+ tester passerar.

### Migration av sparad state
Om settings persisteras (t.ex. localStorage): lägg till en enkel migration som plockar `settings.naming.maxLength` (eller första paketets `maxLength`) och flyttar till `settings.chirp.maxLength` vid laddning, samt strippar fältet från sub-objekten. Om ingen persistens finns hoppar vi över detta steg.

### Sidoplock (orelaterat men billigt)
Hydration-warningen i `ChannelPacksPanel` ("server: 2, client: 0") tyder på att antal valda kanaler räknas olika på server vs klient — troligen `localStorage`-läsning vid första render. Tas i separat ärende, inte i denna plan.

### Filer som ändras
- `src/lib/chirp/models.ts`
- `src/lib/chirp/defaults.ts`
- `src/lib/chirp/naming.ts`
- `src/lib/chirp/pipeline.ts`
- `src/lib/chirp/__tests__/naming.test.ts`
- `src/routes/index.tsx`
