# Verifiering och CI

## Ändringar

### 1. `package.json`
Lägg till nytt script:
```json
"verify": "bun run test && bun run build"
```
Inga andra script ändras. `build` förblir `vite build`.

### 2. `.github/workflows/ci.yml` (ny fil)
Workflow som körs på push till `main` och alla PR:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run test
      - run: bun run build
```

Notera: `bun run test` (inte `bun test`) så att package-scriptet `"test": "vitest run"` används, inte Buns inbyggda test-runner.

### 3. `README.md`
Lägg till kort avsnitt "Verifiering":
- `bun run test` — kör Vitest (175 tester).
- `bun run verify` — kör tester + produktionsbuild lokalt, motsvarar CI.

## Oförändrat
- `vite.config.ts`, `vitest.config.ts`
- `bun run build` (kör inte tester automatiskt)
- `bun run dev`
