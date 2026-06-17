# Metadatarensning — måttlig

Mål: ta bort dött från template-arvet utan att röra app-beteende eller core-logik i `src/lib/codeplug/`.

## 1. package.json

- `name`: `"tanstack_start_ts"` → `"swedish-repeaters-to-codeplug"`.
- Ta bort dependencies (ingen import någonstans i `src/`):
  - `date-fns`
  - `@hookform/resolvers`
  - `@radix-ui/react-accordion`
  - `@radix-ui/react-alert-dialog`
  - `@radix-ui/react-aspect-ratio`
  - `@radix-ui/react-avatar`
  - `@radix-ui/react-checkbox`
  - `@radix-ui/react-collapsible`
  - `@radix-ui/react-context-menu`
  - `@radix-ui/react-dialog`
  - `@radix-ui/react-dropdown-menu`
  - `@radix-ui/react-hover-card`
  - `@radix-ui/react-label`
  - `@radix-ui/react-menubar`
  - `@radix-ui/react-navigation-menu`
  - `@radix-ui/react-popover`
  - `@radix-ui/react-progress`
  - `@radix-ui/react-radio-group`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
  - `@radix-ui/react-slider`
  - `@radix-ui/react-slot`
  - `@radix-ui/react-tabs`
  - `@radix-ui/react-toggle`
  - `@radix-ui/react-toggle-group`
  - `@radix-ui/react-tooltip`
  - `cmdk`
  - `embla-carousel-react`
  - `input-otp`
  - `react-day-picker`
  - `react-hook-form`
  - `react-resizable-panels`
  - `recharts`
  - `sonner`
  - `vaul`
- Behåll: `@radix-ui/react-switch` (används av `src/components/ui/switch.tsx`), plus alla aktiva deps (TanStack, React, Tailwind, Vite, `jszip`, `papaparse`, `zod`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`).

## 2. Radera oanvända shadcn-filer

Allt i `src/components/ui/` förutom `switch.tsx` raderas (45 filer): accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, table, tabs, textarea, toggle, toggle-group, tooltip.

Verifierat: endast `PreviewTable.tsx` importerar från `@/components/ui` (`Switch`). Inga andra referenser finns.

## 3. Verifiering

1. `bun install` så `bun.lock` speglar nya `package.json`.
2. `bun test` → ska vara 142/143 (samma som idag).
3. Build körs av harness — ska gå igenom utan TS- eller resolve-fel.
4. Manuell smoke i preview: ladda SK6BA-CSV, välj target (CHIRP + VGC), exportera, ladda kanalpack, split-export. Du verifierar.

## Vad som inte ändras

- Ingen ändring i `src/lib/codeplug/`, `src/hooks/`, `src/components/codeplug/`, eller `src/routes/`.
- Ingen DMR-modellförberedelse.
- Ingen UI-redesign.
- `tw-animate-css`, `tailwindcss`, `@tailwindcss/vite` behålls (används av `src/styles.css` / Tailwind v4 pipeline).

## Risk

Låg. Filerna som raderas har noll inkommande imports. Enda nyans: om någon CSS-regel i `src/styles.css` refererar shadcn-specifika klasser kollar jag det innan radering och rapporterar tillbaka om något oväntat dyker upp.
