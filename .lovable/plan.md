## Status

Hämtade just `https://se-codeplug.lovable.app/` — SSR-HTML listar bara `chirp-generic`, `vgc-n76` och `nicsure-rt880` i target-dropdownen. Varken RT-Systems-målet eller mode-toggle-UI finns med. Den senaste publiceringen har alltså inte gått ut, trots att `preview_ui--publish` rapporterade "scheduled".

## Är GitHub Actions-varningen relaterad?

**Nej.** Varningen
> Node.js 20 is deprecated … actions/checkout@v4 … forced to run on Node.js 24

är en kosmetisk deprecation-notis från GitHub Actions-runnern. Den får inte jobbet att failas och påverkar inte Lovables publiceringspipeline — Lovable bygger och deployar via sin egen infra, inte via vår `ci.yml`. CI-jobbet kör bara `bun install`, `bun run test`, `bun run build` för verifiering. Vi kan separat byta `actions/checkout@v4` mot `@v5` för att tysta varningen, men det löser inte deploy-problemet.

## Åtgärd

1. **Trigga publish på nytt** via `preview_ui--publish`. Tidigare körning verkar inte ha plockat upp commiten med FTM-510/mode-toggles, möjligen pga timing mellan commit-landning och deploy-schemaläggning.
2. **Verifiera live** efter ~1 min genom att hämta `se-codeplug.lovable.app` igen och bekräfta att "RT-Systems Yaesu FTM-510" finns i target-listan.
3. **Om det fortfarande inte uppdaterar**: föreslå History-vyn / be dig kontrollera Publish-dialogen i UI:t (kan finnas en "Update"-knapp som inte triggades).
4. **Separat (frivilligt)**: bumpa `actions/checkout@v4` → `@v5` i `.github/workflows/ci.yml` för att rensa Node 20-deprecation-varningen. Säger till om du vill att jag tar det i samma sväng.