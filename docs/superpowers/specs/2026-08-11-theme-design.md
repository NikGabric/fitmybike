# Visual identity: Calibration

Date: 2026-08-11
Branch: `worktree-feat+theme`
Status: approved, ready for implementation planning

## Context

`apps/web` currently ships stock shadcn-flavoured tokens: a neutral blue-grey ramp, one blue
primary at `oklch(52% 0.17 258)`, a single system font stack, `0.6rem` radius everywhere. The
result is competent and anonymous — the same CSS would suit an invoicing tool. Both the login
page and the sidebar lead with lucide's generic `Bike` glyph.

This spec defines a real visual identity and applies it to the screens that exist today.

## Scope

In scope: the token system, the five `components/ui` primitives, `AppShell`, `LoginPage`,
`CustomersPage`, `CustomerFormPage`, the brand mark and the favicon.

Out of scope, explicitly:

- No new screens, routes, components-with-behaviour or features.
- No theme toggle. Dark mode stays driven by `prefers-color-scheme`, exactly as today.
- No changes to `packages/shared` or to any API module, so `pnpm openapi` is not in play.
- No changes to `formatHeight` / `formatWeight`. See "Numbers" below.

## Concept

The app is the instrument the fit is read off — a drafting surface with a scale on it, not a
bike-lifestyle brand and not a CRM. Every decision below derives from the fitter's real tools
(calipers, spirit levels, plumb lines, graph paper) and from the product's own non-negotiable:
millimetres and grams, stored as integers.

**Desk and sheet.** The page background is the gunmetal-green desk; cards are the near-white
sheet laid on it. Cards therefore go *lighter* than the ground, which gives `Card` a reason to
exist beyond "box with a shadow".

**One accent, one job.** Hi-viz orange marks a measured value or the thing you are acting on.
It is never decoration and never a non-actionable state.

## Color

Authored as CSS custom properties in `apps/web/src/style.css`, keeping the existing
`@theme inline` bridge so Tailwind utility names (`bg-card`, `text-muted-foreground`, …) keep
working unchanged.

| Token                    | Light                   | Dark                    |
| ------------------------ | ----------------------- | ----------------------- |
| `--background` (desk)    | `oklch(92.5% 0.007 150)` | `oklch(19% 0.008 150)`  |
| `--card` (sheet)         | `oklch(98.5% 0.003 150)` | `oklch(23% 0.009 150)`  |
| `--foreground` (graphite)| `oklch(22% 0.012 150)`  | `oklch(94% 0.005 150)`  |
| `--muted`                | `oklch(95% 0.006 150)`  | `oklch(27% 0.010 150)`  |
| `--muted-foreground`     | `oklch(48% 0.012 150)`  | `oklch(68% 0.010 150)`  |
| `--border` (rule)        | `oklch(87% 0.008 150)`  | `oklch(32% 0.012 150)`  |
| `--input` (control edge) | `oklch(58% 0.014 150)`  | `oklch(54% 0.016 150)`  |
| `--primary` (hi-viz)     | `oklch(67% 0.21 42)`    | `oklch(72% 0.19 45)`    |
| `--primary-foreground`   | `oklch(22% 0.012 150)`  | `oklch(19% 0.008 150)`  |
| `--accent-ink` (new)     | `oklch(52% 0.19 42)`    | `oklch(76% 0.16 50)`    |
| `--destructive`          | `oklch(50% 0.20 20)`    | `oklch(66% 0.19 22)`    |
| `--ring`                 | `oklch(52% 0.19 42)`    | `oklch(72% 0.19 45)`    |

`--destructive-foreground` is **removed**, from both the `:root` blocks and the `@theme inline`
bridge, along with the `destructive` button variant it exists to serve. A grep confirms that
variant is defined but rendered nowhere — `--destructive` is used only as *text* and icon colour
(`FieldError`, the two form error banners, the customers error row, the archive icon) and as an
invalid-input outline. Fill is reserved for orange, so both are dead weight. `--accent-ink` is
the only addition.

Four decisions carry weight here.

**Orange buttons take graphite text, not white.** White on `oklch(67% 0.21 42)` is a contrast
failure that ships constantly. Black-on-hi-viz is both accessible and literally how warning
labels and spirit levels are marked. `--primary-foreground` is therefore the dark ink in *both*
themes, so the primary button renders near-identically light and dark — an identity anchor.

**Two orange tokens, because one cannot do both jobs.** A fill light enough to carry black text
is too light to *be* text. `--accent-ink` is the darkened cousin used for links on interaction.
This is a new token; the rest of the names already exist.

*Amended after seeing it rendered:* `--accent-ink` was originally specified for links and
measured values at rest. On the customers list that produced a column of thirteen orange names,
which reads as wallpaper rather than as a mark and defeats the one-accent-one-job rule. Links are
now graphite at rest and take the accent on hover, so a given screen shows the accent about
twice — the primary button and the active sidebar rail. Measured values carry their emphasis
through the mono tabular face instead of through colour.

**`--input` is much darker than `--border`.** These are already separate tokens in the current
file but hold near-identical values. A row separator is decorative and may be faint; an input
outline is the boundary that identifies the control, and WCAG 1.4.11 wants 3:1 for it. Splitting
them properly is what makes the form screens pass. A crisp dark hairline on a white sheet also
happens to be correct for a drafting instrument.

**`--destructive` sits at hue 20**, clearly red and well separated from the orange at hue 42, so
archive and delete never read as "the orange thing". Destructive never takes a filled button —
fill is reserved for orange — and the archive control on the customers list stays a ghost button
with red iconography, exactly as it is today.

### Contrast verification

All 26 meaningful foreground/background pairs were computed (oklch → linear sRGB → WCAG 2.1
relative luminance) and pass at their required threshold: 4.5:1 for text, 3:1 for input outlines
and focus rings. Tightest margins, which implementation must not erode:

| Pair                              | Ratio | Min |
| --------------------------------- | ----- | --- |
| dark `--input` on dark `--card`   | 3.35  | 3   |
| light `--input` on light `--bg`   | 3.42  | 3   |
| light `--input` on light `--card` | 4.08  | 3   |
| dark `--destructive` on dark card | 4.95  | 4.5 |
| light graphite on orange button   | 5.30  | 4.5 |

Any later change to `--input`, `--destructive` or either orange must be re-checked against these.

## Typography

Two `@fontsource-variable` packages, self-hosted and bundled by Vite. No external requests, which
keeps the single-origin rule intact and works offline in Docker.

Verified against the published packages (`@fontsource-variable/archivo@5.3.0`,
`@fontsource-variable/jetbrains-mono@5.3.0`): importing `@fontsource-variable/archivo/standard.css`
yields **one** family, `Archivo Variable`, declared `font-weight: 100 900` and
`font-stretch: 62% 125%`. Display-expanded and body-normal therefore come from a single file.

Three roles:

| Role    | Family              | Setting                                    | Used for                          |
| ------- | ------------------- | ------------------------------------------ | --------------------------------- |
| Display | Archivo Variable    | `font-stretch: 125%`, weight 600, caps     | Wordmark, page titles             |
| Body    | Archivo Variable    | `font-stretch: 100%`, weight 400/500, 14px | Prose, labels, controls           |
| Data    | JetBrains Mono Var. | weight 400/500, `tabular-nums`             | Every number; eyebrow labels 11px |

Tokens: `--font-display`, `--font-sans`, `--font-mono`, exposed through `@theme inline` as
`--font-*` so `font-display` / `font-mono` work as Tailwind utilities.

Display is tracked `-0.01em`; the wordmark and eyebrow labels are caps tracked `+0.10em`.

### Numbers

`formatHeight` and `formatWeight` in `packages/shared/src/units.ts` return a combined string
(`"182.5 cm"`, `"74.5 kg"`) — confirmed by reading the source. Splitting the numeral from the
unit so the unit could be set smaller would mean changing shared, which is out of scope and its
own PR. Numbers are therefore styled as returned: mono, `tabular-nums`, no DOM surgery.

## Structure

**Radius** drops from `0.6rem` to **3px** (`--radius: 0.1875rem`). Machined edge — neither a
rounded app card nor the zero-radius broadsheet look, which is its own cliché.

**The tick-rail** is the signature: a repeating rule with a short tick every 4px and a tall tick
every fifth, drawn with CSS `repeating-linear-gradient`, no images, in `--border` with the fifth
tick in `--input`.

It earns its place because the millimetre *is* the product's unit — it encodes something true
rather than decorating. Restraint is part of the spec: it appears in exactly three places.

1. Directly under each page header.
2. Along the top edge of the login card.
3. As the left-edge marker of the active sidebar item, where the ticks turn orange.

Nowhere else. Implementations that add a fourth are wrong.

## The mark

`components/BrandMark.vue` — an inline SVG built from tick-rail logic: five vertical ticks of
graduated height with the third full-height and orange. A scale with a reading on it. It reads
as a measurement at any size and needs no accompanying text.

Replaces the lucide `Bike` glyph in `AppShell` and `LoginPage`. Also becomes the favicon, added
to `apps/web/index.html` as an inline `data:` URI (there is no `apps/web/public` directory today
and this spec does not add one).

## Components

| File                        | Change                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| `style.css`                 | Token rewrite, both themes, font faces, base styles, tick-rail utility        |
| `main.ts`                   | Two font imports                                                              |
| `apps/web/package.json`     | Two `@fontsource-variable` dependencies                                       |
| `button-variants.ts`        | Graphite-on-orange default; outline uses `--input`; ghost; drop `destructive` |
| `Button.vue`                | No structural change                                                          |
| `Card.vue`                  | Sheet treatment: 3px radius, `--border` hairline, flatter shadow              |
| `Input.vue`                 | `--input` outline, mono for numeric fields, orange focus ring                 |
| `Label.vue`                 | Mono eyebrow: 11px, caps, `+0.10em`                                           |
| `FieldError.vue`            | `--destructive`, mono                                                         |
| `AppShell.vue`              | `BrandMark`, wordmark, tick-rail active-item marker                           |
| `LoginPage.vue`             | `BrandMark`, tick-rail card edge, display title                               |
| `CustomersPage.vue`         | Mono tabular columns, mono caps table head, orange-marked interactive elements |
| `CustomerFormPage.vue`      | Same primitives; mono numeric inputs                                          |
| `BrandMark.vue`             | New                                                                           |
| `TickRail.vue`              | New                                                                           |
| `index.html`                | Favicon                                                                       |

## Constraints

- **Every `data-testid` and `aria-label` survives verbatim.** The Playwright and Vitest suites key
  off them: `new-customer`, `customer-search`, `customers-table`, `customers-empty`,
  `customers-error`, `login-error`, `login-submit`, `logout`, and the per-row
  `Archive {first} {last}` labels. Visible copy that tests assert on stays byte-identical unless
  the test is updated in the same commit.
- Keyboard focus is visible in both themes: 2px `--ring`, 2px offset in `--background`.
- `prefers-reduced-motion: reduce` is respected.
- Motion is limited to interactive-state transitions. No scroll reveals, no load choreography.
- Responsive behaviour is preserved, including the sidebar's `sm:` breakpoint collapse.

## Verification

`pnpm verify` is the gate — lint, typecheck, contract check, unit and integration tests. Then
`pnpm e2e` against the seeded dev database. `pnpm openapi` is not required, as no shared schema
or controller signature changes.

Beyond the automated gate: both themes are checked by forcing `prefers-color-scheme`, and the
login, customers-list and customer-form screens are viewed at mobile width with the keyboard
alone to confirm focus visibility.

## Risks

- **Contrast regressions.** The five tight pairs above have little headroom. Any nudge to
  `--input`, `--destructive` or the oranges needs re-checking.
- **`font-stretch` support.** The expanded display depends on the `wdth` axis reaching the
  browser. Verified present in the package; to be confirmed rendering in Chromium during e2e.
- **Test coupling to copy.** If a Playwright assertion turns out to match on styled text that the
  reskin changes, the test is updated in the same commit rather than the design being bent
  around it.
