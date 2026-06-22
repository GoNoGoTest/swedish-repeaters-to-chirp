Publicerade appen kör fortfarande en äldre build — frontend-ändringar (som det nya RT-Systems Yaesu FTM-510-målet och mode-toggle-omarbetningen) går live först när appen publiceras om.

## Åtgärd

1. Kör säkerhetsskanning (`security--get_scan_results`) som preflight inför publicering.
2. Verifiera att site-metadata (title/meta/OG) i `src/routes/__root.tsx` är aktuell — uppdatera vid behov innan publish.
3. Kör `preview_ui--publish` för att deploya senaste preview-build till `se-codeplug.lovable.app`.
4. Informera dig om att deploy är schemalagd (~1 min innan den syns live).

Inga kodändringar utöver eventuell metadata-justering.