## Mål

1. Default för `rxOnlyPolicy`:
   - För target `rt-systems-yaesu-generic`: `"skip"` (Hoppa över helt) — vi saknar verifierat RX-only-beteende.
   - Övriga target (chirp-generic, vgc-n76, nicsure-rt880): `"block_tx"` (Spärra TX i radion) som idag.
2. Target-specifik hjälptext under "RX-only-kanaler"-dropdownen.
3. Banner-varning (amber, samma stil som "CHIRP Generic CSV kan bära…") i både **Sortering & export** och **Förhandsgranska & exportera** så fort RX-only-kanaler faktiskt går vidare till exporten:
   > "Du exporterar kanaler som är RX-only — verifiera i din radio att du inte kan sända på dessa kanaler."

## Ändringar

### Default-policy per target
- Globala `DEFAULT_SETTINGS.packs.rxOnlyPolicy` i `src/lib/codeplug/defaults.ts` lämnas på `"block_tx"`.
- I `src/routes/index.tsx` (där target byts) tvinga `rxOnlyPolicy = "skip"` när användaren väljer `rt-systems-yaesu-generic` och nuvarande värde är default-stilen (eller om det inte är något användaren själv ändrat). Enklast: när `settings.export.targetId` ändras till rt-systems, sätt `settings.packs.rxOnlyPolicy = "skip"`; när det ändras från rt-systems till ett target med fungerande RX-only, sätt tillbaka till `"block_tx"`.
- Hittar vi en befintlig "on target change"-effekt återanvänder vi den; annars läggs en liten `useEffect` på `settings.export.targetId` i `index.tsx`.

### `src/components/codeplug/ExportPanel.tsx`
- Ersätt det statiska `hint` på "RX-only-kanaler"-fältet med target-specifik `<Hint>` under selecten:
  - `chirp-generic`: "'Spärra TX' sätter Duplex=off i CHIRP."
  - `vgc-n76`: "'Spärra TX' sätter tx_dis=1 i VGC-CSV:n."
  - `nicsure-rt880`: "'Spärra TX' sätter TX_Power=N/T och TX=RX i RT-880-CSV:n."
  - `rt-systems-yaesu-generic`: "RT Systems Yaesu: RX-only-kanaler exkluderas alltid ur exporten — vi saknar dokumentation om hur RT Systems markerar RX-only i CSV:n. Valet ovan ignoreras."
  - fallback: kort generisk text.
- Ny `RxOnlyExportNote`-komponent (amber-border, samma stil som `ChirpDigitalNote` i `RepeaterFilterPanel.tsx`) renderas direkt under fältet när:
  - `channels` (post-pipeline) innehåller minst en `c.rx_only || !c.tx_allowed`, **och**
  - target inte är `rt-systems-yaesu-generic` (det target:et exkluderar alltid → ingen "du exporterar RX-only").
  - Text: "Du exporterar kanaler som är RX-only — verifiera i din radio att du inte kan sända på dessa kanaler."

### `src/routes/index.tsx`
- I "Förhandsgranska & exportera"-sektionen, mellan `duplicateStop`-alerten och `Stat`-griden, rendera samma `RxOnlyExportNote` baserat på `exportChannels` och `settings.export.targetId`.
- Lägg in target-change-effekten ovan (skip vid rt-systems, block_tx annars).

### Lämnas orört
- `applyRxOnlyPolicy` i `pipeline.ts`, warning-koder, target-exporters. Existerande `rt_rx_only_excluded`-warning fortsätter synas i vanliga varningslistan.

## Acceptanskriterier

- Byt target till rt-systems-yaesu-generic: dropdownen hoppar till "Hoppa över helt" och hjälptexten förklarar att valet ignoreras + att vi saknar dokumentation.
- Byt target tillbaka till chirp/vgc/nicsure: dropdownen återgår till "Spärra TX i radion".
- Med ett RX-only-paket aktiverat och policy=block_tx/mark på chirp/vgc/nicsure: amber-banner i både exportpanelen och förhandsgranskningen.
- Med rt-systems-yaesu-generic: ingen "du exporterar RX-only"-banner (inga RX-only-kanaler exporteras).
