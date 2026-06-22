# Status

Klar: nytt RT Systems Yaesu-exportmål + mode-toggle-omläggning.

## Implementerat

- `src/lib/codeplug/modes.ts` — `KNOWN_MODES`, `parseModes`, alias-tabell (YSF/DN→C4FM, DSTAR→D-Star m.fl.).
- `NormalizedChannel.mode_effective` — sätts av channel_pack-importern och av expansion-steget.
- `FilterSettings.modes: string[]` + migrering från äldre `modeStrategy`/`customModes`.
- `pipeline.expandModes` — multi-mode SK6BA-rader expanderas till en kanal per markerat mode.
- `applyFilters` slutade gate:a på mode (det gör expansion nu).
- `{mode}`-token i naming + `abbreviations.mode`-override.
- `HardwareLimits.supportedSignalModes` — utgråad-state per target i UI.
- `RepeaterFilterPanel` — toggles för alla `KNOWN_MODES`, utgråade om ej stödda av valt mål.
- Nytt exportmål `rt-systems-yaesu-generic` ("RT Systems Yaesu ???"):
  21-kolumners CSV, FM→`FM`, C4FM→`DN`, simplex/duplex/split, CTCSS/DCS/Tone-Mode, name-trunkering, Skip/Scan, `rt_unsupported_mode`-warning för D-Star/DMR/etc.
- Stödjer split-export via `buildSplitFiles`.
- Settings-panel i ExportPanel.

## Tester

226/226 gröna. Nya:
- `modes.test.ts` (10)
- `targets/rt-systems-yaesu.test.ts` (13)
- pipeline expansion-tester (4)
- naming `{mode}`-tester (3)

## Kvarstår

- Ingen automatisk UI-test för utgråade toggles (visuellt).
- Eventuell modellspecifik justering när konkret Yaesu-modell väljs (filtillägg, Step-domän, AMS-default).
