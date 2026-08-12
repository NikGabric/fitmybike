# Deployment

How Fit My Bike is deployed, and how to operate it once it is running.

## Environments

| | Branch | Host | Data | Status |
| --- | --- | --- | --- | --- |
| **Staging** | `staging` | demo VPS | seeded demo data, disposable | what this document sets up |
| **Production** | `main` | production VPS | a real studio's records | **not deployable yet** — see [Before production](#before-production) |

Both are the same compose stack with different `.env` files. Each branch builds and
deploys its own images, so staging and production run separate builds of the same
source.

Staging exists so the app can be clicked through on a real device at a real URL. It has
no backups and its database can be lost without consequence. Do not put a working
studio's customer records on it.

## Branch flow

```
feat/*  ──PR (squash)──▶  staging  ──CI green──▶  demo VPS
                             │
                             └──PR (merge commit)──▶  main  ──CI green──▶  production VPS
```

Feature branches target `staging` and squash-merge, as before. The promotion PR from
`staging` to `main` uses a **merge commit, not a squash** — squashing would collapse
every feature since the last promotion into one opaque commit on `main`, and the two
branches would immediately diverge because `main` would contain a commit `staging` has
never seen.

Nothing is pushed directly to either branch.

## Topology

One VPS per environment, one compose stack, one service published.

```
internet ──443──▶ caddy          auto-TLS, the only published service
                    └──▶ web       :80    nginx: SPA + /api reverse proxy
                          └──▶ api    :3000
                                └──▶ db     unpublished
```

`web` publishes nothing to the host — Caddy reaches it on the compose network, so there
is no plaintext port sitting open beside 443. Everything inside is unchanged from local
development: nginx still proxies `/api` to `http://api:3000`, so the browser still talks
to exactly one origin and there is still no CORS anywhere. That property is why this runs
on a plain VPS rather than a PaaS, where `api:3000` would not resolve and the single
origin would have to be given up.

## Prerequisites

- A VPS with Docker and the compose plugin. A Hetzner CX22 or equivalent is oversized.
- A domain, with an **A record pointing at the VPS before first boot**. Caddy cannot get
  a certificate for a name that does not resolve to it.
- The GHCR packages published from CI (`fitmybike-api`, `fitmybike-web`) set to public,
  so the server needs no registry credentials.

## One-time server setup

The server holds no source. It needs three files in one directory:

```
/opt/fitmybike/
  compose.yaml     from the repo
  Caddyfile        from the repo
  .env             created here, never committed
```

`.env` is `.env.example` with real values. The three that matter:

| Variable | Value | Why |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | generated | The default `fitmybike` is a development convenience. |
| `APP_URL` | `https://fit.example.com` | The public HTTPS URL. Never derived from the Host header. |
| `SEED_PASSWORD` | chosen by you | The owner password the seed creates. Without it you get `changeme123` on a public URL. |

`NODE_ENV=production` is baked into the image and is what turns on `Secure` session
cookies. They work because the browser reaches Caddy over HTTPS; the plaintext hop from
Caddy to nginx is internal to the compose network.

## First deploy

```bash
docker compose pull
docker compose up -d
```

Migrations need no step of their own: the API entrypoint runs `prisma migrate deploy`
before the server accepts traffic, on every boot and every restart. It only applies
committed migrations and never resets anything.

Then seed once, to create the demo organizations and an account to log in with:

```bash
docker compose exec api pnpm seed
```

This is manual and deliberately not part of the pipeline — it is a one-time bootstrap,
not a deploy step. Log in as `owner@fitmybike.test` with the `SEED_PASSWORD` you set.

**Staging only.** Production must never be seeded: the seed creates fictional studios
and customers, and its accounts have a password you have written down somewhere.

## Ongoing deploys

Merging does not deploy. The deploy workflow triggers on the **CI workflow completing
successfully** for the branch, so nothing ships whose tests have not passed.

```
CI green on staging → build images → push ghcr :<sha> and :staging → ssh demo VPS → pull, up -d
CI green on main    → build images → push ghcr :<sha> and :latest  → ssh prod VPS → pull, up -d
```

Repository secrets: `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`, and the matching
`PROD_*` set. Keys are per-host, so a compromised staging key does not reach production.

## Rollback

Images are tagged with the commit SHA, so rolling back is picking an older one:

```bash
IMAGE_TAG=<previous-sha> docker compose up -d
```

Set `IMAGE_TAG` in `.env` to make it stick across restarts. Note this rolls back **code
only** — a migration that has already run stays applied. Prisma migrations here are
additive, but a destructive one would need restoring from a backup, which staging does
not have.

## Before production

Production is not a deployment task away. Three things must exist first, and the first
is a blocker rather than a nicety.

1. **A way to create an organization.** There is no signup, no invitation flow and no
   admin UI. `auth.controller.ts` exposes only `login`, `logout` and `me`; the
   `Invitation` model exists in the schema but nothing in `src/` uses it.
   `prisma/seed.ts` is the only thing that can create an organization or a user, and it
   creates fictional ones. Until this closes, a production box is an app a real studio
   cannot log into.
2. **Backups with a restore you have actually performed.** An untested backup is a
   belief, not a backup. Losing a studio's fit history loses their business records.
3. **A retention and deletion answer.** Production holds real people's names, emails,
   phone numbers and dates of birth in an EU jurisdiction. Deleting a customer currently
   sets `deletedAt` and keeps the row forever, which is the right default for audit and
   the wrong one for an erasure request.

Monitoring and log shipping are worth adding around the same time, but they are not
gates in the way these three are.

## Known limitations

- **`session.ip` records the wrong address.** Two proxies sit in front of the API and
  `main.ts` sets no `trust proxy`, so sessions record the nginx container's address
  rather than the visitor's. Harmless on staging; wrong if those records are ever used
  for security, which is a production concern.
- **Seeded demo data is publicly reachable.** The customers are invented, but anyone who
  finds the hostname reaches a login page. `SEED_PASSWORD` is what stands between them
  and the demo records, so make it a real password.
- **Re-seeding does not change an existing password.** The seed's upsert updates name,
  role and organization but not `passwordHash`, so `SEED_PASSWORD` only takes effect on
  a database that has no such user yet.
- **Staging and production run separate builds.** Each branch builds its own images, so
  the artifact exercised on staging is not the one production runs. Promoting a single
  image would remove this; it was traded away for a simpler pipeline.
