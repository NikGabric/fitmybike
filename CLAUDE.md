# Working notes for Claude

**Fit My Bike** is a multi-tenant tool for bike fitting studios. Fitters manage their customers, are
guided through a fit, and email the customer their measurements and resources at the end. Fitters
are the only users — customers have no accounts and never log in. Organizations are invite-only;
there is no public signup.

**Built so far:** session auth, the customers module, the shared-schema/OpenAPI contract, Docker
images and CI (Phase 0); plus bikes, the measurement definition catalog, and the guided fit session
with its four-step wizard.

**Not built yet — do not go looking for it:** photo and video upload, PDF fit sheets, shareable
customer report links, the resource library, and email sending. `EmailLog` exists as an empty outbox
table with no sender behind it.

`README.md` describes the architecture. This file covers what is non-obvious, easy to break
silently, or would otherwise be rediscovered the hard way.

## Start here

`apps/api/src/modules/customers/` is the reference module. Every tenant-scoped resource copies its
shape:

- `customers.service.ts` — all access through `this.prisma.forOrg(orgId)`
- `customers.controller.ts` — org id from `@CurrentUser()`, never from the body or a path param
- `customers.dto.ts` — DTOs generated from the shared Zod schemas via `createZodDto`

`apps/api/test/customers.spec.ts` is the template for tests, and its `tenant isolation` block is the
one to copy hardest.

## Local development

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev
```

Postgres is on **5432** (compose project `fitmybike-dev`). Web on 5173, API on 3000, docs at
`/api/docs`. Log in as `owner@fitmybike.test` / `changeme123`.

The seed creates **two organizations on purpose** — `owner@alpinelab.test` owns the second. Tenant
leaks are invisible with a single tenant, so check both when touching anything tenant-scoped.

## Verifying a change

`pnpm verify` runs the whole gate, the same one CI runs. Individually:

| Command              | Covers                                                        |
| -------------------- | ------------------------------------------------------------- |
| `pnpm lint`          | ESLint, including the raw-Prisma tenant guard                 |
| `pnpm typecheck`     | All three packages                                            |
| `pnpm openapi`       | Regenerates the spec and typed client — **commit the result** |
| `pnpm openapi:check` | Fails if the committed contract is stale                      |
| `pnpm test`          | Web unit + API integration, including tenant isolation        |
| `pnpm e2e`           | Playwright against real Chromium; starts both servers itself  |

`pnpm e2e` drives the seeded dev database, so run `db:seed` first if you have reset it. The API
integration tests manage their own separate database and need nothing.

## Workflow

- **Never push to `main`.** Branch (`feat/`, `fix/`, `chore/`, `docs/`), open a PR, squash merge.
  Branches are deleted on merge.
- CI must be green before merge: lint, typecheck, contract check, unit, integration, e2e.
- **After changing any shared Zod schema or controller signature, run `pnpm openapi` and commit
  the result.** `pnpm openapi:check` fails CI on a stale contract.
- One PR per vertical slice. A schema change, the API module that uses it, and the UI on top are
  three reviewable PRs, not one.

## Non-negotiables

- **Tenant scoping.** Reach a tenant-scoped model only through `this.prisma.forOrg(orgId)`
  (`apps/api/src/common/prisma/`). Raw access is an ESLint error. Cross-tenant access returns
  **404, never 403** — a 403 confirms the record exists.
- **No CORS, anywhere.** One origin in every environment: Vite proxies `/api` in dev, nginx does in
  prod, NestJS sets a global `api` prefix. If you are reaching for `enableCors()`, the topology has
  broken. Corollaries: never register `/api` as a Vue Router path, NestJS must issue relative
  redirects, never set a cookie `Domain`.
- **Store SI units.** Millimetres and grams, as integers. Convert only at the display edge via
  `packages/shared/src/units.ts`.
- **Validation is defined once**, in `packages/shared`, and consumed by both NestJS DTOs and the
  Vue forms.

## Adding a tenant-scoped model

1. Add the model to `apps/api/prisma/schema.prisma` with an `organizationId` and an index on it.
2. Add its name to `TENANT_MODELS` in `apps/api/src/common/prisma/tenant-client.ts` — **without
   this the model is not scoped and leaks across organizations.**
3. Add the same name to `TENANT_MODELS` in `eslint.config.js` — **without this the lint guard
   silently stops covering it.** Two separate lists; both must be updated.
4. `pnpm db:migrate` to generate the migration.
5. Schemas in `packages/shared`, DTOs via `createZodDto`, service and controller copied from
   customers.
6. `pnpm openapi` and commit the regenerated files.
7. Copy the `tenant isolation` tests from `apps/api/test/customers.spec.ts`. A tenant-scoped
   resource without them is not finished.

## Traps that fail silently

These produce no error — they just quietly do the wrong thing.

- **Never apply `@typescript-eslint/consistent-type-imports` to `apps/api`.** A constructor
  parameter type looks type-only to TypeScript but `emitDecoratorMetadata` emits it as a _value_
  into `design:paramtypes`. Rewriting it to `import type` breaks dependency injection and — for
  DTOs, whose metatype `ZodValidationPipe` reads — silently stops validating requests.
- **esbuild-based loaders do not emit `emitDecoratorMetadata`.** Running NestJS through `tsx` or
  bare Vitest leaves every constructor dependency `undefined`. The API tests use SWC; the OpenAPI
  emitter runs from compiled `dist`.
- **Build `packages/shared` _before_ emitting OpenAPI.** Otherwise the spec is generated against a
  stale `dist` and schema changes vanish without a word. The `openapi` script does this already —
  do not reorder it.
- **Do not set tsc `incremental` in `apps/api`.** nest-cli's `deleteOutDir` wipes `dist/` while
  `.tsbuildinfo` still claims those outputs exist, so only changed files are re-emitted and the
  build comes out half-empty.
- **Prisma 7** has no bundled query engine — it needs `@prisma/adapter-pg`. Keep the
  `prisma-client-js` generator; the newer `prisma-client` one emits ESM-only code (`import.meta`)
  that a CommonJS NestJS build cannot load.
- **Vue number-casts `v-model` on `<input type="number">`.** A form schema declaring `z.string()`
  for a numeric field rejects everything the user types with "expected string, received number",
  which reads as the form simply not submitting. Numeric form fields accept `string | number`.
- **`db:*` scripts wrap `dotenv -e .env`** and are for local use. CI has no `.env`; it uses
  `db:deploy`, which does not.
- **The measurement catalog syncs on API boot**, from `MEASUREMENT_DEFINITIONS` in
  `packages/shared`, not from a migration or `prisma/seed.ts`. `apps/api/test/global-setup.ts`
  rebuilds the test database with `prisma db push --force-reset`, which runs neither — seed it
  either of those ways and it is silently absent under `pnpm test`. A key removed from the shared
  array is retired, not deleted, so old fits keep resolving their labels.
- **Autosaving endpoints must be idempotent.** The fit wizard saves on a debounce *and* on blur, so
  overlapping batches hit the same rows. `deleteMany` + `createMany` in a transaction loses one of
  them to a unique violation; the measurement endpoints upsert in `definitionId` order instead.
  Anything else that autosaves needs the same treatment.
- **A mutation's `onError` must reach a visible failure state.** Reporting only Zod `details` left
  the wizard showing "Saved" after a 409, which is worse than showing nothing.

## Fit measurements

`Fit` records one session against one `Bike`. Values live in two tables, not one:

- `FitBodyMeasurement` — one `value`, no stage. A fit changes the bike, not the person on it.
- `FitBikeMeasurement` — a `stage` (`BEFORE`/`AFTER`) plus a `value`.

`FitStage` is `BEFORE`/`AFTER` **only**. The wizard's resume pointer is a separate `FitStep`
(`BODY`/`BIKE_BEFORE`/`BIKE_AFTER`/`REVIEW`) and is a UI concern — the step-to-(category, stage)
mapping lives in `FitWizardPage.vue` and nowhere else.

Units are integers in the unit the catalog names: `MM`, `DECIMILLIMETRE` (tenths of a mm — stock
cranks are 172.5), `DECIDEGREE` (tenths of a degree), `GRAM`. Fit measurements display in mm, not
cm; `formatHeight` still renders a rider's body height in cm.
