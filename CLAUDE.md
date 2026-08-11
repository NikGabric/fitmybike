# Working notes for Claude

`README.md` describes the architecture — read it there, it is not repeated here. This file covers
only what is non-obvious or easy to break silently.

## Workflow

- **Never push to `main`.** It is protected. Branch (`feat/`, `fix/`, `chore/`, `docs/`), open a
  PR, squash merge. Branches are deleted on merge.
- CI must be green before merge: lint, typecheck, contract check, unit, integration, e2e.
- **After changing any shared Zod schema or controller signature, run `pnpm openapi` and commit
  the result.** `pnpm openapi:check` fails CI on a stale contract.
- One PR per vertical slice. A schema change, the API module that uses it, and the UI on top are
  three reviewable PRs, not one.

## Non-negotiables

- **Tenant scoping.** Reach a tenant-scoped model only through `this.prisma.forOrg(orgId)`
  (`apps/api/src/common/prisma/`). Raw access is an ESLint error, and the rule's model list must be
  kept in step with `TENANT_MODELS` in `eslint.config.js`. Cross-tenant access returns **404, never
  403** — a 403 confirms the record exists.
- **No CORS, anywhere.** One origin in every environment: Vite proxies `/api` in dev, nginx does in
  prod, NestJS sets a global `api` prefix. If you are reaching for `enableCors()`, the topology has
  broken. Corollaries: never register `/api` as a Vue Router path, NestJS must issue relative
  redirects, never set a cookie `Domain`.
- **Store SI units.** Millimetres and grams, as integers. Convert only at the display edge via
  `packages/shared/src/units.ts`.
- **Validation is defined once**, in `packages/shared`, and consumed by both NestJS DTOs and the
  Vue forms.

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

## Local development

```bash
pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev
```

Postgres is on **5432** (compose project `fitmybike-dev`). Log in as
`owner@fitmybike.test` / `changeme123`.

The seed creates **two organizations on purpose** — `owner@alpinelab.test` owns the second. Tenant
leaks are invisible with a single tenant, so check both when touching anything tenant-scoped.
