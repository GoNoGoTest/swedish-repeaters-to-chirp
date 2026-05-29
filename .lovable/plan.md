## Mål

Stötta DCS/DTCS som accessmetod för SK6BA-rader. När access innehåller `DCS 025` (eller varianter) ska CHIRP-exporten skriva `Tone=Cross`, `DtcsCode=025`, `DtcsPolarity=NN`, `CrossMode=DTCS->`, utan att röra `rToneFreq`/`cToneFreq`. Pack-grenens befintliga DTCS-hantering (`tone_raw=DTCS`) lämnas orörd.

## Ändringar

### 1. `src/lib/chirp/tones.ts`

Utöka `ToneParse`:

```ts
export interface ToneParse {
  ctcss: number | null;
  uses1750: boolean;
  carrier: boolean;
  dcs: string | null; // normaliserad 3-siffrig DCS-kod
}
```

Tokeniserings­logik:

- Splitta som idag på `[\s/|;]+`.
- Före nuvarande number-loop: skanna tokens efter DCS-mönster:
  - Token-par: `DCS`/`DTCS` följt av rent siffer­token (1–3 siffror) → fånga koden.
  - Enkel token: `^(?:DCS|DTCS)0*(\d{1,3})$` (sammanskrivet, t.ex. `DCS025`).
  - Enkel token: `^D0*(\d{1,3})$` endast om token är exakt 4 tecken och börjar med `D` följt av siffror, för att inte kollidera med t.ex. `D7` som distriktsnotation om sådan dyker upp i access. Säker eftersom access-fält.
- Normalisera koden via `String(n).padStart(3, "0")`.
- Konsumera de tokens som matchats så att `025` inte sen råkar gå in i CTCSS-loopen (i praktiken faller 25 utanför 40–300, men explicit konsumtion är säkrare).
- Returnera `dcs: string | null`.

Prioritet i parsern: ren parsning, ingen prioritet — den görs i exporten/normaliseraren.

### 2. `src/lib/chirp/pipeline.ts` (normalize)

- Plocka `access.dcs` och lagra på SK6BA-kanalen. Förslag: återanvänd `dtcs_code` (pack-fältet) — den är tomsträng för SK6BA idag och fyller exakt samma roll. Sätt även `dtcs_polarity = "NN"` när `dcs` finns. (Alternativt nytt fält `ctcss_tx_dcs`; återanvändning är minimalt invasivt.)
- Lägg varning `unknown_access` redan idag-villkor utvidgas: `!ctcss && !uses1750 && !carrier && !dcs && r.access`.
- Lägg varning `ctcss_and_dcs` när både `access.ctcss` och `access.dcs` finns (informativ).

### 3. `src/lib/chirp/exporters/chirp.ts` (`resolveToneFields`, SK6BA-grenen)

Ny prioritetsordning i SK6BA-grenen:

1. `c.ctcss_tx != null` → `Tone=Tone`, `rToneFreq` (oförändrat).
2. Annars `c.dtcs_code` (från access-DCS) → `Tone=Cross`, `DtcsCode=c.dtcs_code`, `DtcsPolarity="NN"`, `CrossMode="DTCS->"`, övriga tomma.
3. Annars `EMPTY_TONE`.

Pack-grenen (`source_type === "channel_pack"`) lämnas helt orörd — den styrs av `tone_raw`.

### 4. Tester

- `src/lib/chirp/__tests__/tones.test.ts`: parsa `DCS 025`, `DCS025`, `DTCS 025`, `DTCS025`, `D025` → `dcs === "025"`. Parsa `25` (utan DCS-prefix) → `dcs === null`. Parsa `1750/DCS 025` → `dcs === "025"`, `uses1750 === true`. Parsa `123.0/DCS 025` → båda satta.
- `src/lib/chirp/__tests__/exporters/chirp.test.ts`: SK6BA-kanal med `dtcs_code="025"`, `dtcs_polarity="NN"` (utan `ctcss_tx`) → `Tone=Cross`, `DtcsCode=025`, `DtcsPolarity=NN`, `CrossMode=DTCS->`, `rToneFreq` och `cToneFreq` tomma. CTCSS+DCS samtidigt → CTCSS vinner.
- `src/lib/chirp/__tests__/pipeline.test.ts`: regressionsfall — rad med `type=Link`, `mode=FM`, `network=AllStarLink`, `access="DCS 025"`, `output=145.2375`, `tx_shift=Simplex` → exporterad kanal med rätt fält och `Frequency=145.237500`.

## Det jag avråder från i förslaget

- Att lägga in `D025` som obligatoriskt format om källdata aldrig använder det — risk för fel­matchning. Stöder det defensivt (endast `D` + siffror, exakt fyra tecken), men det är inte ett krav.

## Risker

Låga. Pack-export­logiken är isolerad via `source_type`-check och rörs inte. `EMPTY_TONE`-fallback gäller fortfarande för rader utan CTCSS och utan DCS. Inga API-ändringar utåt; bara `ToneParse` får ett nytt fält och en SK6BA-kanal kan nu få `dtcs_code` ifyllt.
