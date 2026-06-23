## Mål

Skärpa CI/verifiering så att lokala `bun run verify` och GitHub Actions kör samma fyra steg: typecheck, lint, test, build. ESLint blir strikt på oanvända variabler med `_`-prefix som escape hatch.

## Ändringar

### `package.json` — scripts
```json
"typecheck": "tsc --noEmit",
"lint": "eslint . --max-warnings=0",
"format": "prettier --write .",
"format:check": "prettier --check .",
"test": "vitest run",
"verify": "bun run typecheck && bun run lint && bun run format:check && bun run test && bun run build"
```
- `verify` kör allt i ordningen som ger snabbast feedback (typecheck/lint/format först, build sist).
- `build:dev`, `dev`, `preview`, `test:watch` lämnas orörda.

### `eslint.config.js`
- Ta bort `"@typescript-eslint/no-unused-vars": "off"`.
- Lägg till regeln explicit med `_`-escape så avsiktligt oanvända argument/variabler kan prefixas med `_`:
  ```js
  "@typescript-eslint/no-unused-vars": ["error", {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_",
    destructuredArrayIgnorePattern: "^_",
    ignoreRestSiblings: true,
  }],
  ```

### `tsconfig.json`
- Lämnas orörd för nu. ESLint-regeln täcker samma yta med smidigare escape hatch; vi slipper en andra mekanism som rapporterar samma sak. (Om vi senare hittar fall som TS fångar men ESLint missar lägger vi på `noUnusedLocals`/`noUnusedParameters` då.)

### `.github/workflows/ci.yml`
Ersätt två steg med ett:
```yaml
- run: bun install --frozen-lockfile
- run: bun run verify
```

### Fallout-fix
1. Kör `bun run typecheck` och åtgärda eventuella typfel som idag tystas av Vite-only-builden.
2. Kör `bun run lint` och fixa fallout från den nya regeln:
   - Avsiktligt oanvända argument: byt namn till `_argname`.
   - Oanvända imports/variabler: ta bort eller prefixa med `_`.
3. Kör `bun run format:check` och kör `bun run format` om något inte är prettier-formaterat. Lägga sedan om koden så `format:check` blir grön.
4. Slutligen `bun run verify` lokalt — måste vara grön innan ändringen är klar.

## Acceptanskriterier

- `bun run verify` kör typecheck → lint (0 warnings) → format:check → test → build, alla gröna.
- CI-jobbet kör `bun install --frozen-lockfile` följt av enbart `bun run verify`.
- ESLint accepterar `_`-prefixade oanvända argument; alla andra oanvända symboler är fel.
- Inga regressioner i testsviten (262 tester gröna).
