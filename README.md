# Fit My Bike

Bike fitting studio management: fitters keep their customers, are guided through a fit, and hand
over measurements and resources by email at the end.

What exists: customers, their bikes, the measurement definition catalog, and the guided fit session
— a four-step wizard that records the rider, the bike as it arrived and the bike as delivered, and
shows what changed. Photos, PDF fit sheets, shareable report links and email sending are not built
yet. Customers is still the reference module every later one is copied from.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vue 3 + TypeScript, Vite, Vue Router, Pinia, TanStack Query, Tailwind, VeeValidate |
| Backend | NestJS 11, Prisma 7, Postgres 17, argon2 |
| Contract | NestJS emits OpenAPI → `openapi-typescript` → typed `openapi-fetch` client |
| Tests | Vitest (API integration + web unit), Playwright (e2e) |
| Deploy | Docker Compose |

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm db:up          # Postgres 17 on localhost:5432
pnpm db:migrate     # apply migrations
pnpm db:seed        # two organizations + demo customers
pnpm dev            # api :3000, web :5173
```

Open <http://localhost:5173> and sign in:

| Email | Password | Role | Organization |
|---|---|---|---|
| `owner@fitmybike.test` | `changeme123` | OWNER | Fit My Bike Studio |
| `fitter@fitmybike.test` | `changeme123` | FITTER | Fit My Bike Studio |
| `owner@alpinelab.test` | `changeme123` | OWNER | Alpine Bike Lab |

The second organization exists on purpose: multi-tenant bugs are invisible with only one tenant.
Log in as each and confirm neither sees the other's customers.

API docs: <http://localhost:3000/api/docs>

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Shared package watcher + API + web, concurrently |
| `pnpm build` | Build all three packages |
| `pnpm test` | Vitest across API and web |
| `pnpm e2e` | Playwright against a real browser (starts both servers) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm openapi` | Regenerate `openapi.json` and the typed client |
| `pnpm openapi:check` | Fail if the committed contract is stale (for CI) |
| `pnpm db:up` / `db:down` | Start / stop the Postgres container |
| `pnpm db:migrate` / `db:reset` / `db:seed` / `db:studio` | Prisma workflows |

## The four things worth knowing

### 1. Tenant isolation is enforced in one place

Every tenant-scoped model carries `organizationId`, and services must go through
`PrismaService.forOrg()`:

```ts
this.prisma.forOrg(user.organizationId).customer.findMany()
```

`forOrg` returns a Prisma client extension (`src/common/prisma/tenant-client.ts`) that injects
`organizationId` into the `where` clause of every read, update and delete, and into `data` on
every write. Because the filter lands in `where`, a cross-tenant update or delete fails with
Prisma's P2025 and the exception filter turns it into a **404, not a 403** — a 403 would confirm
the record exists.

Reaching for a tenant model on the raw client is an ESLint error (see `TENANT_MODELS` in
`eslint.config.js`). It is not request-scoped DI on purpose: a request-scoped provider makes its
entire dependency subtree request-scoped, which is a silent performance cliff.

The isolation tests in `apps/api/test/customers.spec.ts` are the ones to keep green above all
others.

### 2. Same-origin by construction

The browser only ever talks to one origin. In development Vite proxies `/api` to the API
(`apps/web/vite.config.ts`); in production nginx does the same (`apps/web/nginx.conf`). NestJS
sets a global `api` prefix so URLs are identical in both.

Consequences, all deliberate: **no CORS anywhere**, no preflight requests, no `VITE_API_BASE_URL`,
and the session cookie is a plain first-party host-only `SameSite=Lax` cookie in development
exactly as in production. If you ever find yourself adding `enableCors()`, the topology has broken.

Rules that follow: never register `/api` as a Vue Router path; NestJS must issue **relative**
redirects; never set a cookie `Domain` attribute.

### 3. One schema, both sides

Validation rules live once, in `packages/shared`. NestJS turns them into DTOs via
`createZodDto`; the Vue forms feed the same schemas to VeeValidate. Response types reach the
frontend through the generated OpenAPI client, so a backend change the frontend has not caught up
with is a compile error.

After changing an endpoint or schema, run `pnpm openapi`.

The customer form is the one deliberate exception: it validates centimetres and kilograms because
that is what a fitter writes down, then converts at the boundary
(`apps/web/src/pages/customer-form-schema.ts`).

### 4. Measurements are stored in SI units

Millimetres and grams, as integers, always. Conversion happens only at the display edge via
`packages/shared/src/units.ts`. Nothing in the database or on the wire is ever "centimetres" —
that removes the entire class of bugs where a value's unit depends on who wrote it.

## Authentication

Opaque, database-backed sessions. The cookie holds a 256-bit random token; only its SHA-256 hash
is stored, so a database leak yields no usable sessions. Chosen over JWT + refresh rotation
because it is simpler and instantly revocable — logout deletes a row.

Organizations are invite-only: there is no public signup. Create one with the seed script.

## Deployment

```bash
cp .env.example .env    # set real POSTGRES_*, APP_URL and SITE_ADDRESS
docker compose up -d --build
```

Caddy is the only published service: it terminates TLS and proxies to `web` (nginx), which
serves the built SPA and proxies `/api` to the `api` container. Neither `web` nor Postgres is
published to the host. Migrations run on API container start via `prisma migrate deploy`, which
only applies committed migrations and never resets anything.

TLS is automatic. Set `SITE_ADDRESS` to a hostname and Caddy obtains and renews the certificate
itself; set it to `:80` to run the production stack locally over plain HTTP. `SITE_ADDRESS` and
`APP_URL` must always agree — and note that `NODE_ENV=production` (the image default) makes the
session cookie `Secure`, so login only works over HTTPS.

Deployment, including the CI pipeline and the server runbook, is documented in
[`docs/deployment.md`](docs/deployment.md).

## Notable version pins

- **Prisma 7** requires a driver adapter (`@prisma/adapter-pg`); there is no bundled query engine.
  We use the `prisma-client-js` generator rather than the newer `prisma-client` one, because the
  latter emits ESM-only code (`import.meta`) that a CommonJS NestJS build cannot load.
- **TypeScript stays on 5.x** even though 7.x is out, for ecosystem compatibility with
  `vue-tsc` and the NestJS toolchain.
- The API test suite and the OpenAPI emitter run through SWC / compiled output rather than
  esbuild-based loaders, which do not emit `emitDecoratorMetadata` and would leave NestJS unable
  to resolve constructor injection.

## Layout

```
apps/api          NestJS. modules/ holds features; customers/ is the reference module.
                  bikes/, fits/ and measurement-definitions/ are built on its shape.
apps/web          Vue 3 SPA. pages/, components/ui/, stores/, lib/api.ts.
packages/shared   Zod schemas, unit conversion, generated API types.
                  schemas/measurement.ts is the measurement catalog — the source of
                  truth, mirrored into the database when the API boots.
```
