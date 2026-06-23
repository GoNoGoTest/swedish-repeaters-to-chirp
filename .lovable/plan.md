## Mål

Gör RX-only-beteendet på RT-systems-Yaesu-targetet konsekvent och rensa bort "Stoppa export"-valet överallt.

## Beteende efter ändringen

**RT-systems-Yaesu (rt-systems-yaesu-generic)**
- Dropdown visar bara två val: "Hoppa över helt" (default) och "Exportera normalt + markera RX-ONLY i Comment". "Spärra TX i radion" är inte valbart.
- När det finns RX-only-kanaler i exporten OCH policy=skip → varningsbox i "Förhandsgranska & exportera":
  > "Appen vet inte hur RX-only ska sättas i RT-systems — RX-only-kanaler hoppas över."
- När policy=mark OCH RX-only-kanaler finns → samma gula varning som övriga targets:
  > "Du exporterar kanaler som är RX-only — verifiera i din radio att du inte kan sända på dessa kanaler."
- När policy=mark exporteras RX-only-rader faktiskt (med RX-ONLY i Comment) — den hårdkodade exklusionen i `exportRtSystemsYaesuCsv` tas bort så att pipelinens policy får styra. `rt_rx_only_excluded`-varningen försvinner (ersätts av nya banners).

**Övriga targets (chirp-generic, vgc-n76, nicsure-rt880)**
- Default är fortsatt "Spärra TX i radion".
- Dropdown visar "Spärra TX", "Markera i Comment", "Hoppa över helt". Inget "Stoppa export".
- Existerande gul "Du exporterar kanaler som är RX-only…"-banner oförändrad.

**"Stoppa export"-valet tas bort helt**
- Tas bort ur `RxOnlyPolicy`-typen, ur dropdownen och ur `applyRxOnlyPolicy` i pipeline.ts. Påverkar inte freq-dupe-policyn (den behåller sitt "stop").

## Ändringar

1. **`src/lib/codeplug/models.ts`** — ta bort `"stop"` ur `RxOnlyPolicy`-union.
2. **`src/lib/codeplug/pipeline.ts`** — ta bort `case "stop"` i `applyRxOnlyPolicy`.
3. **`src/lib/codeplug/targets/rt-systems-yaesu.ts`** — ta bort RX-only-exklusionen i `exportRtSystemsYaesuCsv` (loop + `rt_rx_only_excluded`-warning). Pipelinens policy hanterar bortfiltrering vid `skip` och markering vid `mark`.
4. **`src/components/codeplug/ExportPanel.tsx`**
   - Ta bort `<option value="stop">Stoppa export</option>` ur RX-only-dropdown.
   - Filtrera bort `block_tx`-optionen när `targetId === "rt-systems-yaesu-generic"`.
   - Uppdatera `rxOnlyHintForTarget` för RT-systems så hjälptexten reflekterar de två faktiska valen.
   - Bygg om `RxOnlyExportNote`: för RT-systems visas en separat blå/gul info-box när policy=skip OCH `channels` innehåller RX-only ("Appen vet inte hur RX-only…"). När policy=mark visas standard-RX-only-bannern. Övriga targets oförändrade.
5. **`src/routes/index.tsx`** — `useEffect` som tvingar `skip` för rt-systems behålls, men kompletteras: om användaren manuellt valt `mark` ska det inte skrivas över. Lösning: tvinga bara om nuvarande policy är ogiltig för targetet (dvs. `block_tx` eller `stop` → byt till target-default). Annars lämna val orört.
6. **Tester** — uppdatera/lägg till:
   - `src/lib/codeplug/__tests__/targets/rt-systems-yaesu.test.ts`: ta bort förväntan på `rt_rx_only_excluded`; lägg till test att RX-only-rader kommer ut i CSV:n när de når exporten (policy=mark-fallet).
   - `src/lib/codeplug/__tests__/pipeline.test.ts`: ta bort/justera ev. test på `"stop"`-policy.

## Acceptanskriterier

- RX-only dropdown saknar "Stoppa export" på samtliga targets.
- Med target=RT-systems och valbart `block_tx` är inte längre möjligt; default vid byte till RT-systems är "skip".
- Med policy=skip + RX-only-kanaler valda visas RT-systems-banner ovanför previewn med exakt formuleringen ovan.
- Med policy=mark + RX-only-kanaler visas standard RX-only-bannern och RX-only-raderna finns med i den faktiska CSV-exporten med "RX-ONLY" i Comment.
- `bun run verify` är grön.
