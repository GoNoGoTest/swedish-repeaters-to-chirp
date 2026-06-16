## Mål

1. Lyft **val av exportformat** till toppen av sidan så att resten av GUI:t (namnlängd, warnings, split-alternativ) anpassar sig direkt.
2. Lägg till **uppdelning per distrikt** + **chunkning vid hårdvarugräns** för repeaterexporten, levererat som ZIP när flera filer.
3. Sätt **VGC N76 `maxNameLength = 8`** som default.
4. Behåll nuvarande arbetsflöde; ingen stor ombyggnad.

## Ny sidstruktur

```text
┌─ Header
├─ [NY] Exportformat            ← target-väljare + kort beskrivning + limits
├─ Repeatrar (SK6BA / Marks)
├─ Kanalpaket
├─ Sortering & export           ← target-specifik panel + split-block
└─ Förhandsgranska & exportera  ← knapp visar "Exportera VGC N76 (n) [ZIP]" vid split
```

Format-väljaren blir en egen `<Section>` överst med:
- Dropdown över `listTargets()`
- Visar `target.limits` (maxChannels, channelsPerGroup, maxNameLength) som chips
- Liten infotext per target (källa: ny `target.description`-fält)

Befintliga `chirp-specifika` UI-bitar (mode, startLocation) renderas bara när `targetId === "chirp-generic"`. VGC-panelen finns redan.

## Split-block (ny, target-agnostisk inställning)

Lagras under `settings.export.split` (ej per-target — gemensam för alla format
som har `channelsPerGroup`-gräns):

```ts
type SplitSettings = {
  mode: "single" | "per_district" | "per_district_chunked";
  // chunkSize default = target.limits.channelsPerGroup ?? maxChannels
  chunkSize?: number;
};
```

UI (radio + ett nummerfält):
- ☉ En enda fil (default)
- ○ En fil per distrikt → `repeaters_distrikt_<n>.csv`
- ○ Per distrikt + chunka vid `[ 32 ]` kanaler → `..._<n>_#1.csv`, `..._<n>_#2.csv`

Endast repeaterkanaler grupperas per distrikt (har `district`). Kanalpaketkanaler
hamnar i en separat fil `packs.csv` (eller chunkad: `packs_#1.csv`).

Vid `mode !== "single"`: lägg alla filer i en ZIP via `jszip` och ladda ner
`<target.filenameBase>.zip`. Vid `single`: oförändrat beteende.

Warning vid t.ex. mode=per_district och distrikt 6 har 47 kanaler men
chunkSize saknas → `vgc_over_group_limit` (befintlig kod) men UI-meddelandet
föreslår att slå på chunkning.

## VGC `maxNameLength = 8`

Ändra `vgc-n76.ts`:
- `defaultSettings.maxLength: 16` → `8`
- `limits.maxNameLength: 16` → `8`
- Uppdatera testen som kollar 16-tecken trunkering till 8.

Settings i localStorage återställs (vi har redan accepterat reset vid uppgradering).

## Tekniska detaljer

**Targets-API utökas (icke-brytande):**
```ts
type ExportTarget = {
  …
  description?: string;          // kort text för format-väljaren
  exportMany?(channels, settings, split): Array<{filename, content}>;
};
```
Om `exportMany` saknas faller vi tillbaka till `export()` och ignorerar split.
Både chirp-generic och vgc-n76 implementerar `exportMany` genom att gruppera
på `c.district` och chunka med `chunkSize`.

**Filnamnskonvention:**
- Per distrikt: `<base>_distrikt_<n>.csv` (n = distriktssiffra, "0" om saknas)
- Chunkad: `<base>_distrikt_<n>_part<k>.csv`
- Kanalpaket: `<base>_packs.csv` (+ `_part<k>` vid chunkning)
- ZIP-namn: `<base>.zip`

**Beroenden:** `bun add jszip`.

## Tester

- `vgc-n76.test.ts`: uppdatera trunkeringstest till 8 tecken.
- Ny `exportMany.test.ts`:
  - per_district splittar i N filer baserat på `district`
  - per_district_chunked respekterar chunkSize
  - kanaler utan distrikt → `packs.csv`
  - filordning deterministisk (distrikt sorterat numeriskt)
- Bekräfta att 122 befintliga tester fortsatt passerar.

## Inte med i denna PR

- Per-pack split (paket fyller sällan en grupp).
- Anpassad mappning av distrikt→gruppnamn på radion (görs i appen efter import).
- RT Systems / DMR / N76 zone-fil.
- Drag-and-drop ordning av distrikt i export.
