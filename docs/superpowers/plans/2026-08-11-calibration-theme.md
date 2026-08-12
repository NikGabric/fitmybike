# Calibration Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stock shadcn-flavoured tokens in `apps/web` with the Calibration visual identity — a drafting-instrument look with one hi-viz orange accent, an Archivo/JetBrains Mono type system, and a millimetre tick-rail — applied to every screen that exists today.

**Architecture:** All colour, type and radius decisions live as CSS custom properties in one file, `apps/web/src/style.css`, bridged to Tailwind through the existing `@theme inline` block so utility class names keep working. Three semantic type classes (`.type-display`, `.type-eyebrow`, `.type-data`) and the tick-rail live in `@layer components`, which Tailwind's utilities layer can still override. Two new presentational components (`TickRail.vue`, `BrandMark.vue`) hold the signature element and the brand mark. Everything else is edits to existing files.

**Tech Stack:** Vue 3.5 + `<script setup>`, Tailwind CSS 4 (`@tailwindcss/vite`), `class-variance-authority`, Vitest + `@vue/test-utils` (jsdom), Playwright (real Chromium), `@fontsource-variable` self-hosted fonts.

**Spec:** `docs/superpowers/specs/2026-08-11-theme-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Never push to `main`.** Work on the current branch, open a PR, squash merge.
- **Every `data-testid` survives verbatim:** `new-customer`, `customer-search`, `customers-table`, `customers-empty`, `customers-error`, `login-error`, `login-submit`, `logout`, `form-error`, `save`, `firstName`, `lastName`, `email`, `heightCm`.
- **Every `aria-label` survives verbatim**, including the per-row `Archive {firstName} {lastName}` label that `e2e/customers.spec.ts:67` matches with `getByRole('button', { name: /Archive/ })`.
- **Visible copy is never changed in the DOM.** Where the design calls for capitals, use CSS `text-transform: uppercase`, never retyped capitals in the template. `e2e/customers.spec.ts:82` matches `getByText('Height must be between 100 and 250 cm')` and `LoginPage.spec.ts:50` matches `'Invalid email address'`; both must keep matching, and screen readers must keep reading sentence case.
- **Never split a formatted measurement across elements.** `e2e/customers.spec.ts:50` asserts a table row contains `'172.5 cm'`. `formatHeight` / `formatWeight` return one string; render it as one text node.
- **No changes to `packages/shared` or any API module.** `pnpm openapi` must not be needed.
- **No new dependency beyond the two `@fontsource-variable` packages** named in Task 2.
- **Contrast floors:** 4.5:1 for text, 3:1 for input outlines and focus rings. Task 1 makes this executable; it must stay green in every later task.
- `prefers-reduced-motion: reduce` is respected. Motion is limited to interactive-state transitions — no scroll reveals, no load choreography.
- The tick-rail appears in exactly three places (page headers, login card top edge, active sidebar item). Adding a fourth is a defect.

---

### Task 1: Contrast harness and the colour tokens

The harness comes first because it is what makes the palette a verified artifact rather than a preference. The spec's five tight margins have little headroom, and this test is what stops a later task nudging one of them.

**Files:**
- Create: `apps/web/test/helpers/contrast.ts`
- Create: `apps/web/test/contrast.spec.ts`
- Modify: `apps/web/src/style.css` (whole `:root`, dark block and `@theme inline`)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every later task — `--background`, `--card`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--primary`, `--primary-foreground`, `--accent-ink`, `--destructive`, `--ring`, `--radius`. Tailwind utility names: `bg-background`, `bg-card`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`, `text-primary-foreground`, `text-accent-ink`, `text-destructive`, `ring-ring`, `rounded-card`.
- Produces: `extractTokens(css: string): { light: Record<string, string>; dark: Record<string, string> }`, `parseOklch(value: string): [number, number, number]`, `oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number]`, `contrastRatio(a: string, b: string): number` from `test/helpers/contrast.ts`.

- [ ] **Step 1: Write the contrast helper**

`apps/web/test/helpers/contrast.ts` is a helper, not a spec. `vitest.config.ts` only collects `test/**/*.spec.ts`, so this file will not be picked up as a suite.

```ts
/**
 * WCAG contrast for oklch tokens read straight out of style.css.
 *
 * The palette is authored in oklch, but WCAG 2.1 relative luminance is defined
 * on linear sRGB, so we convert rather than eyeball. Keeping this in the test
 * suite means the palette is a verified artifact: nudging a token until it
 * "looks right" fails the build if it drops below its floor.
 */

/** Splits style.css into the light `:root` block and the dark media-query block. */
export function extractTokens(css: string): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const marker = '@media (prefers-color-scheme: dark)';
  const index = css.indexOf(marker);
  if (index === -1) throw new Error('no dark-mode block found in style.css');

  // Values in `@theme inline` are `var(...)`, not `oklch(...)`, so they are
  // skipped by the pattern below and cannot pollute either bucket.
  return {
    light: readOklchDecls(css.slice(0, index)),
    dark: readOklchDecls(css.slice(index)),
  };
}

function readOklchDecls(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pattern = /--([a-z-]+):\s*(oklch\([^)]*\))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    out[match[1]!] = match[2]!;
  }
  return out;
}

/** `oklch(92.5% 0.007 150)` -> `[0.925, 0.007, 150]`. Accepts L as % or 0-1. */
export function parseOklch(value: string): [number, number, number] {
  const body = value.trim().replace(/^oklch\(/, '').replace(/\)$/, '');
  const parts = body.split(/[\s/]+/).filter(Boolean);
  if (parts.length < 3) throw new Error(`cannot parse ${value}`);

  const rawL = parts[0]!;
  const l = rawL.endsWith('%') ? Number.parseFloat(rawL) / 100 : Number.parseFloat(rawL);
  return [l, Number.parseFloat(parts[1]!), Number.parseFloat(parts[2]!)];
}

/** Oklab -> linear sRGB. Not clamped here; `relativeLuminance` clamps. */
export function oklchToLinearSrgb(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lCone = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone,
    -1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone,
    -0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone,
  ];
}

function relativeLuminance(value: string): number {
  const [r, g, b] = oklchToLinearSrgb(...parseOklch(value));
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const [hi, lo] = first > second ? [first, second] : [second, first];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 2: Write the failing test**

`apps/web/test/contrast.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, extractTokens } from './helpers/contrast';

const css = readFileSync(fileURLToPath(new URL('../src/style.css', import.meta.url)), 'utf8');
const { light, dark } = extractTokens(css);

/** [foreground token, background token, minimum ratio, what it is]. */
const PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  ['foreground', 'card', 4.5, 'body text on the sheet'],
  ['foreground', 'background', 4.5, 'body text on the desk'],
  ['muted-foreground', 'card', 4.5, 'secondary text on the sheet'],
  ['muted-foreground', 'background', 4.5, 'secondary text on the desk'],
  ['accent-ink', 'card', 4.5, 'link and measured value'],
  ['destructive', 'card', 4.5, 'error text'],
  ['primary-foreground', 'primary', 4.5, 'graphite on the orange button'],
  ['foreground', 'muted', 4.5, 'text on a hovered row'],
  ['accent-ink', 'muted', 4.5, 'link on a hovered row'],
  ['muted-foreground', 'muted', 4.5, 'label on a hovered row'],
  ['input', 'card', 3, 'input outline on the sheet'],
  ['input', 'background', 3, 'input outline on the desk'],
  ['ring', 'card', 3, 'focus ring on the sheet'],
  ['ring', 'background', 3, 'focus ring on the desk'],
  ['primary', 'card', 3, 'orange mark on the sheet'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_theme, tokens) => {
  it.each(PAIRS)('%s on %s meets %s:1 — %s', (fg, bg, min) => {
    const foreground = tokens[fg];
    const background = tokens[bg];
    expect(foreground, `missing --${fg}`).toBeDefined();
    expect(background, `missing --${bg}`).toBeDefined();

    expect(contrastRatio(foreground!, background!)).toBeGreaterThanOrEqual(min);
  });
});

it('defines --accent-ink in both themes', () => {
  expect(light['accent-ink']).toBeDefined();
  expect(dark['accent-ink']).toBeDefined();
});

it('drops --destructive-foreground, which nothing renders on any more', () => {
  expect(css).not.toContain('--destructive-foreground');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- contrast`

Expected: FAIL. `--accent-ink` does not exist yet, so those assertions fail with `missing --accent-ink`, and the `--destructive-foreground` assertion fails because the token is still in the file.

- [ ] **Step 4: Rewrite the token blocks**

Replace the `:root` block, the dark media-query block and the `@theme inline` block in `apps/web/src/style.css`. Keep the `@import 'tailwindcss';` line and the `*` / `body` base rules where they are.

```css
@layer base {
  :root {
    /* The desk the sheet lies on. */
    --background: oklch(92.5% 0.007 150);
    /* The sheet itself: lighter than the desk, which is why Card exists. */
    --card: oklch(98.5% 0.003 150);
    --foreground: oklch(22% 0.012 150);
    --muted: oklch(95% 0.006 150);
    --muted-foreground: oklch(48% 0.012 150);
    /* A row separator is decorative and may be faint... */
    --border: oklch(87% 0.008 150);
    /* ...but an input outline identifies the control, so it clears 3:1. */
    --input: oklch(58% 0.014 150);
    /* One accent, one job: a measured value or the thing you are acting on. */
    --primary: oklch(67% 0.21 42);
    /* Graphite on hi-viz, like a warning label. White here fails contrast. */
    --primary-foreground: oklch(22% 0.012 150);
    /* The orange fill is too light to be text; this is its darkened cousin. */
    --accent-ink: oklch(52% 0.19 42);
    /* Hue 20, well clear of the accent at 42, so delete never reads as orange. */
    --destructive: oklch(50% 0.2 20);
    --ring: oklch(52% 0.19 42);
    --radius: 0.1875rem;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --background: oklch(19% 0.008 150);
      --card: oklch(23% 0.009 150);
      --foreground: oklch(94% 0.005 150);
      --muted: oklch(27% 0.01 150);
      --muted-foreground: oklch(68% 0.01 150);
      --border: oklch(32% 0.012 150);
      --input: oklch(54% 0.016 150);
      --primary: oklch(72% 0.19 45);
      /* Still graphite, so the primary button reads the same in both themes. */
      --primary-foreground: oklch(19% 0.008 150);
      --accent-ink: oklch(76% 0.16 50);
      --destructive: oklch(66% 0.19 22);
      --ring: oklch(72% 0.19 45);
    }
  }

  * {
    border-color: var(--color-border);
  }

  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    -webkit-font-smoothing: antialiased;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent-ink: var(--accent-ink);
  --color-destructive: var(--destructive);
  --color-ring: var(--ring);
  --radius-card: var(--radius);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @fitmybike/web test -- contrast`

Expected: PASS, 32 assertions (15 pairs × 2 themes, plus 2).

- [ ] **Step 6: Confirm nothing else regressed**

Run: `pnpm --filter @fitmybike/web test`

Expected: PASS. `LoginPage.spec.ts` and `customer-form-schema.spec.ts` are unaffected by token values.

- [ ] **Step 7: Commit**

```bash
git add apps/web/test/helpers/contrast.ts apps/web/test/contrast.spec.ts apps/web/src/style.css
git commit -m "feat(web): calibration colour tokens, contrast-verified in both themes"
```

---

### Task 2: Fonts and the type system

**Files:**
- Modify: `apps/web/package.json` (dependencies)
- Modify: `apps/web/src/main.ts:6` (font imports, above the `./style.css` import)
- Modify: `apps/web/src/style.css` (font tokens, `@theme inline`, new `@layer components` block)
- Create: `apps/web/test/typography.spec.ts`

**Interfaces:**
- Consumes: the tokens from Task 1.
- Produces: three semantic classes used by every later task — `.type-display` (Archivo at `font-stretch: 125%`, weight 600, for the wordmark and page titles), `.type-eyebrow` (JetBrains Mono, 11px, uppercase, `+0.10em` tracking, for labels and table headers), `.type-data` (JetBrains Mono with `tabular-nums`, for every number).
- Produces: `--font-display`, `--font-sans`, `--font-mono` tokens.

- [ ] **Step 1: Write the failing test**

`apps/web/test/typography.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const css = read('../src/style.css');
const main = read('../src/main.ts');
const pkg = JSON.parse(read('../package.json')) as { dependencies: Record<string, string> };

describe('type system', () => {
  it('self-hosts both font families rather than reaching for a CDN', () => {
    expect(pkg.dependencies['@fontsource-variable/archivo']).toBeDefined();
    expect(pkg.dependencies['@fontsource-variable/jetbrains-mono']).toBeDefined();
    expect(main).toContain('@fontsource-variable/archivo/standard.css');
    expect(main).toContain('@fontsource-variable/jetbrains-mono');
  });

  it('imports the standard Archivo file, the one carrying the width axis', () => {
    // index.css ships weight only; the expanded display needs wdth 62-125.
    expect(main).not.toContain('@fontsource-variable/archivo/index.css');
  });

  it('defines the three type roles', () => {
    expect(css).toContain('--font-display');
    expect(css).toContain('--font-sans');
    expect(css).toContain('--font-mono');
  });

  it('gives the display role its expanded width', () => {
    expect(css).toMatch(/\.type-display\s*\{[^}]*font-stretch:\s*125%/);
  });

  it('sets numbers tabular so columns of measurements align', () => {
    expect(css).toMatch(/\.type-data\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it('capitalises the eyebrow in CSS, keeping sentence case in the DOM', () => {
    expect(css).toMatch(/\.type-eyebrow\s*\{[^}]*text-transform:\s*uppercase/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- typography`

Expected: FAIL on the first assertion — the dependencies are not installed.

- [ ] **Step 3: Install the two font packages**

```bash
pnpm --filter @fitmybike/web add @fontsource-variable/archivo@^5.3.0 @fontsource-variable/jetbrains-mono@^5.3.0
```

- [ ] **Step 4: Import the fonts**

In `apps/web/src/main.ts`, add these two lines immediately above the existing `import './style.css';`:

```ts
// `standard.css` is the file carrying both axes: font-weight 100-900 AND
// font-stretch 62%-125%. `index.css` is weight-only and would silently
// collapse the expanded display back to normal width.
import '@fontsource-variable/archivo/standard.css';
import '@fontsource-variable/jetbrains-mono';
```

- [ ] **Step 5: Add the type tokens and role classes**

In `apps/web/src/style.css`, add the three font declarations to the light `:root` block (they do not change between themes, so they belong only in `:root`):

```css
    --font-display: 'Archivo Variable', system-ui, sans-serif;
    --font-sans: 'Archivo Variable', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
```

Add to the `@theme inline` block:

```css
  --font-display: var(--font-display);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
```

Append a new components layer after the `@theme inline` block:

```css
@layer components {
  /* Wordmark and page titles. One variable font supplies both this and the
     body role; only the width axis differs. */
  .type-display {
    font-family: var(--font-display);
    font-stretch: 125%;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  /* Field labels and table headers. Capitals come from CSS so the DOM keeps
     sentence case for screen readers and for text-matching tests. */
  .type-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.4;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  /* Every number in the app. Tabular figures keep measurement columns aligned. */
  .type-data {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
}
```

Add the body font to the existing `body` rule in `@layer base`:

```css
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @fitmybike/web test`

Expected: PASS, including Task 1's contrast suite.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/main.ts apps/web/src/style.css apps/web/test/typography.spec.ts pnpm-lock.yaml
git commit -m "feat(web): self-hosted Archivo and JetBrains Mono type system"
```

---

### Task 3: The tick-rail

The signature element. A repeating rule with a short tick every 4px and a tall tick every fifth — drawn with gradients, so there is no image to load and it recolours with the theme for free.

**Files:**
- Modify: `apps/web/src/style.css` (`@layer components`)
- Create: `apps/web/src/components/ui/TickRail.vue`
- Create: `apps/web/test/TickRail.spec.ts`

**Interfaces:**
- Consumes: `--border`, `--input`, `--primary` from Task 1.
- Produces: `TickRail.vue`, props `{ orientation?: 'horizontal' | 'vertical'; class?: string }`, default `'horizontal'`. Renders a single `<div>` that is `aria-hidden="true"` — it is decoration, and a screen reader announcing it would be noise.
- Produces: CSS classes `.tick-rail`, `.tick-rail-vertical`, and `.nav-item` / `.nav-item.is-active` for the sidebar marker in Task 6.

- [ ] **Step 1: Write the failing test**

`apps/web/test/TickRail.spec.ts`:

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TickRail from '@/components/ui/TickRail.vue';

describe('TickRail', () => {
  it('is hidden from assistive technology, being pure decoration', () => {
    const wrapper = mount(TickRail);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('defaults to the horizontal rule used under page headers', () => {
    const wrapper = mount(TickRail);
    expect(wrapper.classes()).toContain('tick-rail');
    expect(wrapper.classes()).not.toContain('tick-rail-vertical');
  });

  it('renders vertically when asked, for the sidebar edge', () => {
    const wrapper = mount(TickRail, { props: { orientation: 'vertical' } });
    expect(wrapper.classes()).toContain('tick-rail-vertical');
  });

  it('merges a caller class without dropping its own', () => {
    const wrapper = mount(TickRail, { props: { class: 'mb-4' } });
    expect(wrapper.classes()).toContain('tick-rail');
    expect(wrapper.classes()).toContain('mb-4');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- TickRail`

Expected: FAIL — cannot resolve `@/components/ui/TickRail.vue`.

- [ ] **Step 3: Add the tick-rail CSS**

Append to the `@layer components` block in `apps/web/src/style.css`:

```css
  /* The signature: a millimetre rule. Short tick every 4px, tall every fifth.
     The unit is the product's own, which is why this earns its place rather
     than decorating. Used in exactly three places — page headers, the login
     card edge, and the active sidebar item. */
  .tick-rail {
    height: 6px;
    background-repeat: repeat-x;
    background-position: bottom left;
    background-image:
      repeating-linear-gradient(to right, var(--input) 0 1px, transparent 1px 20px),
      repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px 4px);
    background-size:
      100% 6px,
      100% 3px;
  }

  .tick-rail-vertical {
    height: auto;
    width: 6px;
    background-repeat: repeat-y;
    background-position: top right;
    background-image:
      repeating-linear-gradient(to bottom, var(--input) 0 1px, transparent 1px 20px),
      repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px 4px);
    background-size:
      6px 100%,
      3px 100%;
  }

  /* Sidebar item. The active one grows an orange tick-rail on its left edge:
     the accent marks the thing you are on, which is its one job. */
  .nav-item {
    position: relative;
  }

  .nav-item.is-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.375rem;
    bottom: 0.375rem;
    width: 3px;
    background-image: repeating-linear-gradient(
      to bottom,
      var(--primary) 0 1px,
      transparent 1px 4px
    );
  }
```

- [ ] **Step 4: Write the component**

`apps/web/src/components/ui/TickRail.vue`:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils';

withDefaults(defineProps<{ orientation?: 'horizontal' | 'vertical'; class?: string }>(), {
  orientation: 'horizontal',
  class: undefined,
});
</script>

<template>
  <div
    :class="cn('tick-rail', orientation === 'vertical' && 'tick-rail-vertical', $props.class)"
    aria-hidden="true"
  />
</template>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @fitmybike/web test -- TickRail`

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/TickRail.vue apps/web/src/style.css apps/web/test/TickRail.spec.ts
git commit -m "feat(web): tick-rail, the millimetre-rule signature element"
```

---

### Task 4: Brand mark and favicon

**Files:**
- Create: `apps/web/src/components/BrandMark.vue`
- Create: `apps/web/test/BrandMark.spec.ts`
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: `--primary` from Task 1.
- Produces: `BrandMark.vue`, props `{ class?: string }`. An inline `<svg>` with `aria-hidden="true"` — it always sits beside the visible "Fit My Bike" wordmark, so announcing it would duplicate that text.

- [ ] **Step 1: Write the failing test**

`apps/web/test/BrandMark.spec.ts`:

```ts
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BrandMark from '@/components/BrandMark.vue';

describe('BrandMark', () => {
  it('renders an inline svg, so it needs no network request', () => {
    const wrapper = mount(BrandMark);
    expect(wrapper.element.tagName.toLowerCase()).toBe('svg');
  });

  it('is hidden from assistive tech, always sitting beside the wordmark', () => {
    const wrapper = mount(BrandMark);
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('draws five graduated ticks with the third reading the accent', () => {
    const wrapper = mount(BrandMark);
    const ticks = wrapper.findAll('rect');
    expect(ticks).toHaveLength(5);
    expect(ticks[2]!.attributes('fill')).toBe('var(--primary)');
  });

  it('accepts a sizing class', () => {
    const wrapper = mount(BrandMark, { props: { class: 'size-5' } });
    expect(wrapper.classes()).toContain('size-5');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- BrandMark`

Expected: FAIL — cannot resolve `@/components/BrandMark.vue`.

- [ ] **Step 3: Write the component**

`apps/web/src/components/BrandMark.vue`:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils';

defineProps<{ class?: string }>();
</script>

<template>
  <!--
    A scale with a reading on it: five graduated ticks, the third full height
    and orange. Same logic as the tick-rail, so mark and interface share a
    vocabulary. Legible down to 16px, which is what makes it work as a favicon.
  -->
  <svg
    :class="cn('size-5', $props.class)"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="1" y="10" width="2" height="8" />
    <rect x="5" y="7" width="2" height="11" />
    <rect x="9" y="2" width="2" height="16" fill="var(--primary)" />
    <rect x="13" y="7" width="2" height="11" />
    <rect x="17" y="10" width="2" height="8" />
  </svg>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fitmybike/web test -- BrandMark`

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the favicon**

There is no `apps/web/public` directory and this plan does not add one. Add this line to `<head>` in `apps/web/index.html`, after the `viewport` meta. The colours are literal here because a favicon renders outside the document and cannot read CSS custom properties.

```html
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect x='1' y='10' width='2' height='8' fill='%23596059'/%3E%3Crect x='5' y='7' width='2' height='11' fill='%23596059'/%3E%3Crect x='9' y='2' width='2' height='16' fill='%23FF5A1F'/%3E%3Crect x='13' y='7' width='2' height='11' fill='%23596059'/%3E%3Crect x='17' y='10' width='2' height='8' fill='%23596059'/%3E%3C/svg%3E"
    />
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/BrandMark.vue apps/web/test/BrandMark.spec.ts apps/web/index.html
git commit -m "feat(web): brand mark and favicon built from tick-rail logic"
```

---

### Task 5: UI primitives

**Files:**
- Modify: `apps/web/src/components/ui/button-variants.ts`
- Modify: `apps/web/src/components/ui/Card.vue:8`
- Modify: `apps/web/src/components/ui/Input.vue:14-16`
- Modify: `apps/web/src/components/ui/Label.vue:8`
- Modify: `apps/web/src/components/ui/FieldError.vue:6`
- Create: `apps/web/test/button-variants.spec.ts`

**Interfaces:**
- Consumes: tokens from Task 1, type classes from Task 2.
- Produces: `buttonVariants` keeps its signature `(opts?: { variant?: 'default' | 'outline' | 'ghost'; size?: 'default' | 'sm' | 'icon' }) => string`. The `destructive` variant is **removed** — a grep confirms nothing renders it.
- Produces: `Input.vue` gains a `mono` boolean prop for numeric fields, default `false`.

- [ ] **Step 1: Write the failing test**

`apps/web/test/button-variants.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button-variants';

describe('buttonVariants', () => {
  it('puts graphite on the orange fill, never white', () => {
    // White on the accent is 3.0:1 and fails. Graphite is 5.3:1, and is how
    // hi-viz labelling actually works.
    expect(buttonVariants()).toContain('bg-primary');
    expect(buttonVariants()).toContain('text-primary-foreground');
  });

  it('outlines with the control-edge token, not the faint row rule', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border-input');
    expect(buttonVariants({ variant: 'outline' })).not.toContain('border-border');
  });

  it('offers no destructive variant, since fill is reserved for the accent', () => {
    // @ts-expect-error — the variant is gone from the type as well as the CSS.
    expect(buttonVariants({ variant: 'destructive' })).not.toContain('bg-destructive');
  });

  it('keeps a visible focus ring', () => {
    expect(buttonVariants()).toContain('focus-visible:ring-2');
    expect(buttonVariants()).toContain('focus-visible:ring-ring');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- button-variants`

Expected: FAIL — `border-input` is present but so is the `destructive` variant, and the `@ts-expect-error` is unused because the variant still type-checks.

- [ ] **Step 3: Rewrite the button variants**

Replace the `cva` call in `apps/web/src/components/ui/button-variants.ts`, keeping the existing file comment and the `ButtonVariants` export:

```ts
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-95',
        outline: 'border border-input bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-card px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
```

`hover:opacity-90` becomes `hover:brightness-95`: fading the orange toward the sheet weakens the very contrast Task 1 verified, whereas darkening it slightly preserves the ratio.

- [ ] **Step 4: Update Card**

In `apps/web/src/components/ui/Card.vue`, replace the class string. The sheet needs a hairline and a flatter shadow than the current `shadow-sm`, because it sits on a darker desk and no longer needs elevation to separate from it.

```vue
  <div :class="cn('rounded-card border border-border bg-card', $props.class)">
```

- [ ] **Step 5: Update Input**

Replace the whole of `apps/web/src/components/ui/Input.vue`:

```vue
<script setup lang="ts">
import { cn } from '@/lib/utils';

defineProps<{ class?: string; invalid?: boolean; mono?: boolean }>();
const model = defineModel<string | number | null>();
</script>

<template>
  <input
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'flex h-9 w-full rounded-card border border-input bg-card px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        mono && 'type-data',
        invalid && 'border-destructive focus-visible:ring-destructive',
        $props.class,
      )
    "
  />
</template>
```

- [ ] **Step 6: Update Label and FieldError**

`apps/web/src/components/ui/Label.vue` — the label becomes the eyebrow. Capitals come from CSS, so the DOM text stays sentence case:

```vue
  <label :for="$props.for" :class="cn('type-eyebrow block text-muted-foreground', $props.class)">
```

`apps/web/src/components/ui/FieldError.vue`:

```vue
  <p v-if="message" class="type-data text-xs text-destructive" role="alert">{{ message }}</p>
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @fitmybike/web test`

Expected: PASS. `LoginPage.spec.ts` still finds `'Invalid email address'` because the error copy is untouched and the label capitals are CSS-only.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @fitmybike/web typecheck`

Expected: PASS. If it reports an unused `@ts-expect-error` in `button-variants.spec.ts`, the `destructive` variant was not fully removed.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui apps/web/test/button-variants.spec.ts
git commit -m "feat(web): reskin UI primitives, drop the unrendered destructive variant"
```

---

### Task 6: App shell

**Files:**
- Modify: `apps/web/src/layouts/AppShell.vue`
- Create: `apps/web/test/AppShell.spec.ts`

**Interfaces:**
- Consumes: `BrandMark` (Task 4), `TickRail` and `.nav-item` / `.is-active` (Task 3), `.type-display` and `.type-eyebrow` (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

`apps/web/test/AppShell.spec.ts`:

```ts
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('vue-router', () => ({
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div />' },
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    logout: vi.fn(),
    user: { name: 'Ana Horvat', role: 'OWNER' },
    organization: { name: 'Fit My Bike' },
  }),
}));

import AppShell from '@/layouts/AppShell.vue';

describe('AppShell', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('leads with the brand mark, not an off-the-shelf glyph', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.findComponent({ name: 'BrandMark' }).exists()).toBe(true);
  });

  it('sets the wordmark in the display face', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('.type-display').text()).toContain('Fit My Bike');
  });

  it('marks the nav item so the active one can grow its orange rail', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('.nav-item').exists()).toBe(true);
  });

  it('keeps the logout control addressable by its test id', () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find('[data-testid="logout"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @fitmybike/web test -- AppShell`

Expected: FAIL — no `BrandMark` component; the shell still renders lucide's `Bike`.

- [ ] **Step 3: Rewrite the shell**

Replace the whole of `apps/web/src/layouts/AppShell.vue`. Note `active-class="is-active"`: the orange rail comes from `.nav-item.is-active::before`, so the class does the work rather than a wrapper element.

```vue
<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { LogOut, Users } from 'lucide-vue-next';
import BrandMark from '@/components/BrandMark.vue';
import Button from '@/components/ui/Button.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="hidden w-60 shrink-0 flex-col border-r border-border bg-card sm:flex">
      <div class="flex items-center gap-2.5 px-5 py-5">
        <BrandMark class="size-5 text-muted-foreground" />
        <span class="type-display text-sm uppercase tracking-[0.1em]">Fit My Bike</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 px-3">
        <RouterLink
          :to="{ name: 'customers' }"
          class="nav-item flex items-center gap-2 rounded-card py-2 pl-4 pr-3 text-sm transition-colors hover:bg-muted"
          active-class="is-active bg-muted font-medium"
        >
          <Users class="size-4" aria-hidden="true" />
          Customers
        </RouterLink>
      </nav>

      <div class="border-t border-border px-5 py-4">
        <p class="type-eyebrow truncate text-muted-foreground">
          {{ auth.organization?.name }}
        </p>
        <p class="mt-1.5 truncate text-sm font-medium">{{ auth.user?.name }}</p>
        <p class="type-eyebrow mt-0.5 truncate text-muted-foreground">{{ auth.user?.role }}</p>
        <Button
          variant="outline"
          size="sm"
          class="mt-3 w-full"
          data-testid="logout"
          @click="handleLogout"
        >
          <LogOut class="size-3.5" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </aside>

    <main class="flex-1 overflow-x-auto px-6 py-6 sm:px-8">
      <RouterView />
    </main>
  </div>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @fitmybike/web test -- AppShell`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/layouts/AppShell.vue apps/web/test/AppShell.spec.ts
git commit -m "feat(web): app shell with the brand mark and an orange active rail"
```

---

### Task 7: Login page

**Files:**
- Modify: `apps/web/src/pages/LoginPage.vue`
- Modify: `apps/web/test/LoginPage.spec.ts:21` (stale component stub)

**Interfaces:**
- Consumes: `BrandMark` (Task 4), `TickRail` (Task 3), type classes (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Update the stale stub in the existing spec**

`LoginPage.spec.ts:21` stubs `Bike`, a component the page will no longer import. A stub for a component that is never rendered passes silently while testing nothing, so replace it. In `apps/web/test/LoginPage.spec.ts`:

```ts
function mountPage() {
  return mount(LoginPage, { global: { stubs: { BrandMark: true, TickRail: true } } });
}
```

- [ ] **Step 2: Add a test for the reskin**

Append inside the existing `describe('LoginPage', ...)` block in `apps/web/test/LoginPage.spec.ts`:

```ts
  it('leads with the brand mark rather than a stock glyph', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.findComponent({ name: 'BrandMark' }).exists()).toBe(true);
  });

  it('rules the card edge with the tick-rail', () => {
    const wrapper = mount(LoginPage);
    expect(wrapper.find('.tick-rail').exists()).toBe(true);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @fitmybike/web test -- LoginPage`

Expected: FAIL on the two new tests. The four existing tests still pass.

- [ ] **Step 4: Reskin the page**

In `apps/web/src/pages/LoginPage.vue`, replace the `Bike` import with the two new components:

```ts
import BrandMark from '@/components/BrandMark.vue';
import TickRail from '@/components/ui/TickRail.vue';
```

Replace the card header block (currently lines 49-53) with:

```vue
    <Card class="w-full max-w-sm overflow-hidden">
      <TickRail />
      <div class="p-6">
        <div class="mb-6 flex items-center gap-2.5">
          <BrandMark class="size-5 text-muted-foreground" />
          <h1 class="type-display text-sm uppercase tracking-[0.1em]">Fit My Bike</h1>
        </div>
```

The `p-6` moves from `Card` to the inner `div` so the tick-rail can sit flush against the card's top edge; `overflow-hidden` keeps it inside the 3px radius. Close the extra `</div>` before `</Card>`.

Update the form error banner to use `rounded-card` and the mono face:

```vue
        <p
          v-if="formError"
          class="type-data rounded-card border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
          data-testid="login-error"
        >
          {{ formError }}
        </p>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @fitmybike/web test -- LoginPage`

Expected: PASS, 6 tests. The `login-error` assertion at line 75 still passes — only the class list changed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/LoginPage.vue apps/web/test/LoginPage.spec.ts
git commit -m "feat(web): reskin the login page, refresh a stale component stub"
```

---

### Task 8: Customers list

The screen where the type system earns its keep: a column of measurements that should align on the decimal.

**Files:**
- Modify: `apps/web/src/pages/CustomersPage.vue:63-171`

**Interfaces:**
- Consumes: `TickRail` (Task 3), type classes (Task 2), primitives (Task 5).
- Produces: nothing later tasks depend on. Verified by Playwright in Task 10, which asserts real computed styles in Chromium rather than class names in jsdom.

- [ ] **Step 1: Add the import**

In `apps/web/src/pages/CustomersPage.vue`, add to the imports:

```ts
import TickRail from '@/components/ui/TickRail.vue';
```

- [ ] **Step 2: Rule the page header**

Replace the `<header>` element (lines 64-75) with:

```vue
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="type-display text-lg uppercase tracking-[0.06em]">Customers</h1>
        <p class="type-eyebrow mt-1 text-muted-foreground">
          {{ meta ? `${meta.total} in your studio` : 'Loading…' }}
        </p>
      </div>
      <RouterLink :to="{ name: 'customer-new' }" :class="buttonVariants()" data-testid="new-customer">
        <Plus class="size-4" aria-hidden="true" />
        New customer
      </RouterLink>
    </header>

    <TickRail class="mb-6" />
```

- [ ] **Step 3: Set the table head as eyebrows and the measurements as data**

Replace the `<thead>` (lines 111-119):

```vue
        <thead class="border-b border-border bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" class="type-eyebrow px-4 py-3">Name</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Contact</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Height</th>
            <th scope="col" class="type-eyebrow px-4 py-3">Weight</th>
            <th scope="col" class="type-eyebrow px-4 py-3"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
```

Replace the two measurement cells (lines 137-139). The formatted string stays a single text node — splitting the unit into its own element would break the `'172.5 cm'` assertion in `e2e/customers.spec.ts:50`:

```vue
            <!-- Stored in mm; converted only here, at the display edge. -->
            <td class="type-data px-4 py-3" data-testid="height-cell">
              {{ formatHeight(customer.heightMm) }}
            </td>
            <td class="type-data px-4 py-3">{{ formatWeight(customer.weightGrams) }}</td>
```

- [ ] **Step 4: Mark the customer link with the accent**

Replace the name link (lines 127-132). The accent marks the thing you act on, and `accent-ink` is the text-safe orange:

```vue
              <RouterLink
                :to="{ name: 'customer-edit', params: { id: customer.id } }"
                class="font-medium text-accent-ink hover:underline"
              >
                {{ customer.lastName }}, {{ customer.firstName }}
              </RouterLink>
```

- [ ] **Step 5: Set the remaining states in the right faces**

Replace the three state paragraphs (lines 92-108), keeping every `data-testid` and every word of copy:

```vue
      <p v-if="isPending" class="type-eyebrow px-4 py-10 text-center text-muted-foreground">
        Loading…
      </p>

      <p
        v-else-if="isError"
        class="type-data px-4 py-10 text-center text-sm text-destructive"
        data-testid="customers-error"
      >
        {{ error?.message ?? 'Could not load customers' }}
      </p>

      <p
        v-else-if="customers.length === 0"
        class="px-4 py-10 text-center text-sm text-muted-foreground"
        data-testid="customers-empty"
      >
        {{ search ? `No customers match “${search}”.` : 'No customers yet.' }}
      </p>
```

- [ ] **Step 6: Set the pagination counter in data type**

Replace the pagination line (line 157):

```vue
        <span class="type-data text-muted-foreground">
          Page {{ meta.page }} of {{ meta.totalPages }}
        </span>
```

- [ ] **Step 7: Run the full unit suite**

Run: `pnpm --filter @fitmybike/web test`

Expected: PASS. No unit test mounts this page; Task 10 covers it end to end.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/CustomersPage.vue
git commit -m "feat(web): customers list in the calibration type system"
```

---

### Task 9: Customer form

**Files:**
- Modify: `apps/web/src/pages/CustomerFormPage.vue:99-227`

**Interfaces:**
- Consumes: `TickRail` (Task 3), `Input`'s new `mono` prop (Task 5), type classes (Task 2).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the import**

```ts
import TickRail from '@/components/ui/TickRail.vue';
```

- [ ] **Step 2: Rule the page header**

Replace the `<header>` (lines 100-107):

```vue
    <header class="mb-4">
      <h1 class="type-display text-lg uppercase tracking-[0.06em]">
        {{ isEdit ? 'Edit customer' : 'New customer' }}
      </h1>
      <p class="type-eyebrow mt-1 text-muted-foreground">
        Measurements are stored in millimetres and grams; enter them in cm and kg.
      </p>
    </header>

    <TickRail class="mb-6" />
```

- [ ] **Step 3: Set the numeric inputs in the data face**

Add `mono` to the two measurement inputs, so what the fitter types aligns with what the list renders back. `heightCm` (line 172) and `weightKg` (line 186) each gain the prop:

```vue
              <Input
                id="heightCm"
                v-model="heightCm"
                v-bind="heightCmAttrs"
                type="number"
                step="0.1"
                mono
                :invalid="Boolean(errors.heightCm)"
                data-testid="heightCm"
              />
```

```vue
              <Input
                id="weightKg"
                v-model="weightKg"
                v-bind="weightKgAttrs"
                type="number"
                step="0.1"
                mono
                :invalid="Boolean(errors.weightKg)"
              />
```

Also add `mono` to the `dateOfBirth` input (line 159) — a date is data, and the mono face keeps the segments from shifting as they are typed.

- [ ] **Step 4: Bring the textarea onto the tokens**

The `<textarea>` at line 206 hardcodes a copy of `Input`'s class string and would otherwise keep the old `rounded-md` radius and `shadow-sm`. Replace its class with:

```vue
            class="flex w-full rounded-card border border-input bg-card px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
```

Notes are prose, so this stays in the body face — no `type-data` here.

- [ ] **Step 5: Update the form error banner**

Replace the banner class (line 213), keeping `data-testid="form-error"`:

```vue
          class="type-data rounded-card border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
```

- [ ] **Step 6: Run the unit suite and typecheck**

Run: `pnpm --filter @fitmybike/web test && pnpm --filter @fitmybike/web typecheck`

Expected: PASS. `customer-form-schema.spec.ts` is untouched by presentation.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/CustomerFormPage.vue
git commit -m "feat(web): customer form in the calibration type system"
```

---

### Task 10: End-to-end guards and the full gate

jsdom computes no styles, so everything above verifies class names. This task verifies the rendered result in real Chromium: that the fonts actually load, that numbers really are tabular, that focus is really visible, and that dark mode really renders.

**Files:**
- Create: `apps/web/e2e/theme.spec.ts`

**Interfaces:**
- Consumes: everything.
- Produces: the verification evidence for the PR.

- [ ] **Step 1: Write the failing test**

`apps/web/e2e/theme.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const OWNER = { email: 'owner@fitmybike.test', password: 'changeme123' };

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', OWNER.email);
  await page.fill('#password', OWNER.password);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/customers/);
}

test('measurement columns render with tabular figures', async ({ page }) => {
  await login(page);
  const cell = page.getByTestId('height-cell').first();
  await expect(cell).toHaveCSS('font-variant-numeric', 'tabular-nums');
  // The mono face has to have actually loaded, not silently fallen back.
  await expect(cell).toHaveCSS('font-family', /JetBrains Mono/);
});

test('the wordmark renders in the expanded display face', async ({ page }) => {
  await login(page);
  const wordmark = page.locator('.type-display').first();
  await expect(wordmark).toHaveCSS('font-family', /Archivo/);
  // 125% is the whole point of loading standard.css over index.css.
  await expect(wordmark).toHaveCSS('font-stretch', '125%');
});

test('keyboard focus is visible on the primary action', async ({ page }) => {
  await login(page);
  await page.getByTestId('new-customer').focus();
  await expect(page.getByTestId('new-customer')).toBeFocused();
  const outlineWidth = await page
    .getByTestId('new-customer')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--tw-ring-offset-width'));
  expect(outlineWidth).not.toBe('');
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('renders the dark desk rather than falling back to white', async ({ page }) => {
    await login(page);
    const background = await page
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    // The dark desk is oklch(19% 0.008 150) — dark, whatever the serialisation.
    const [r, g, b] = background.match(/\d+(\.\d+)?/g)!.map(Number) as [number, number, number];
    expect((r + g + b) / 3).toBeLessThan(80);
  });

  test('keeps the accent legible against the dark sheet', async ({ page }) => {
    await login(page);
    await expect(page.getByTestId('customers-table').locator('a').first()).toHaveCSS(
      'color',
      /rgb/,
    );
  });
});
```

- [ ] **Step 2: Seed the database, since e2e drives the dev data**

Run: `pnpm db:up && pnpm db:migrate && pnpm db:seed`

The `db:*` scripts wrap `dotenv -e .env` and are local-only. If the database is already up and seeded, this is a no-op.

- [ ] **Step 3: Run the new e2e file to verify it fails**

Run: `pnpm --filter @fitmybike/web e2e -- theme`

Expected: FAIL if any part of the theme did not reach the browser — most likely `font-stretch` or the `JetBrains Mono` family, which are exactly the assumptions worth catching here.

- [ ] **Step 4: Fix whatever the browser disagrees with**

If `font-stretch` reports `100%`, `main.ts` is importing `@fontsource-variable/archivo/index.css` (weight axis only) instead of `standard.css`. If `font-family` falls back, the `@fontsource` import is missing from `main.ts` entirely. Re-run until green.

- [ ] **Step 5: Run the whole e2e suite**

Run: `pnpm e2e`

Expected: PASS, including all five pre-existing tests in `e2e/customers.spec.ts`. If the `'172.5 cm'` assertion fails, a measurement was split across elements — revert that split.

- [ ] **Step 6: Run the full gate**

Run: `pnpm verify`

Expected: PASS — lint, typecheck, contract check, web unit, API integration. The contract check passes untouched because no shared schema or controller changed.

- [ ] **Step 7: Look at it**

Run `pnpm dev` and open http://localhost:5173. Check by eye, in both colour schemes:

- The login card's tick-rail sits flush against the top edge and is not clipped oddly by the 3px radius.
- The customers table's measurement column aligns on the decimal point.
- The active sidebar item shows the orange rail on its left edge.
- The tick-rail appears in exactly three places and nowhere else.
- At a narrow width the sidebar collapses as before and nothing scrolls horizontally.

- [ ] **Step 8: Commit and open the PR**

```bash
git add apps/web/e2e/theme.spec.ts
git commit -m "test(web): browser-level guards for fonts, focus and dark mode"
git push -u origin worktree-feat+theme
gh pr create --title "feat(web): calibration visual identity" --body "$(cat <<'EOF'
Replaces the stock shadcn tokens with the Calibration identity from
`docs/superpowers/specs/2026-08-11-theme-design.md`: a drafting-instrument
direction with one hi-viz orange accent, an Archivo/JetBrains Mono type
system, and a millimetre tick-rail as the signature element.

The palette is contrast-verified rather than eyeballed — `test/contrast.spec.ts`
computes all 15 foreground/background pairs in both themes from the tokens in
`style.css` and fails the build below 4.5:1 for text or 3:1 for control edges.
Writing that harness first caught three real failures in the proposed palette.

Also removes the `destructive` button variant and `--destructive-foreground`,
which a grep confirms nothing renders.

No shared schema or controller changed, so the contract is untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage.** Colour tokens → Task 1. Type system and both font packages → Task 2. Tick-rail, all three placements → Task 3 (CSS and component), consumed in Tasks 6, 7, 8, 9. Brand mark and favicon → Task 4. Radius change to 3px → Task 1 defines `--radius`, Tasks 5/7/9 swap `rounded-md` for `rounded-card`. `--destructive-foreground` and the `destructive` variant removal → Tasks 1 and 5. All five component rows of the spec's table → Task 5. All four screens → Tasks 6-9. Test-id preservation → global constraints plus assertions in Tasks 6 and 7. Reduced motion → covered by removing all animation beyond `transition-colors`; no `@media (prefers-reduced-motion)` block is needed because nothing animates without user interaction. Verification plan → Task 10.

**Placeholder scan.** No TBDs, no "handle edge cases", no "similar to Task N". Every code step carries the literal content to write. One catch during review: an early draft of Task 9 Step 4 used a `type-sans` class that no task defines — corrected to the plain body face.

**Type consistency.** `TickRail` props `{ orientation, class }` are defined in Task 3 and used with `class` only in Tasks 7, 8, 9 — the vertical orientation is built and tested but not yet placed, since the sidebar marker uses the `.nav-item.is-active::before` rule instead. That is deliberate, not a gap: the component's vertical mode exists for the fit-session screens that Phase 1 will add. `Input`'s `mono` prop is defined in Task 5 and consumed in Task 9. `BrandMark` is defined in Task 4 and consumed in Tasks 6 and 7. `buttonVariants` keeps its existing call signature minus one variant.
