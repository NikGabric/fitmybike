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

- A VPS with Docker and the compose plugin, **amd64** — `deploy.yml` sets no `platforms:`,
  so the images are built for the runner's architecture and an Arm box cannot run them.
  2 vCPU, 4 GB of RAM and 40 GB of disk is comfortable. The provider is not load-bearing —
  the plan's Task 5 lists the ones evaluated.
- A domain, with an **A record pointing at the VPS before first boot**. Caddy cannot get
  a certificate for a name that does not resolve to it.
- Nothing else. The deploy logs the host into GHCR with the workflow's own token, so the
  packages can stay private and there is no registry credential to store on the box.

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
| `SITE_ADDRESS` | `https://fit.example.com` | What Caddy serves. **`.env.example` ships `:80` for the local dry run** — leave that in place on a server and you get no TLS, nothing on 443, and a login that fails silently because `Secure` cookies cannot travel over HTTP. Must always match `APP_URL`. |
| `CADDY_HTTP_PORT` | `80` | `.env.example` ships `8080`, which is right locally and wrong on a server: ACME's HTTP challenge needs port 80. |
| `CADDY_HTTPS_PORT` | `443` | `.env.example` ships `8443`. |
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

## Bootstrapping the pipeline

**The deploy workflow will not fire until `deploy.yml` exists on `main`.** GitHub only
dispatches `workflow_run` for the copy of a workflow on the repository's default branch,
and the default branch is `main`. While the file exists only on `staging`, CI goes green
and nothing happens — no run, no error, nothing to notice.

So the first time only, in this order:

1. Merge the deployment PR into `staging`.
2. Immediately open and merge the promotion PR `staging` → `main` (merge commit, not
   squash). This carries `deploy.yml` onto the default branch. It does not deploy
   anything: the job is gated to `head_branch == 'staging'` while production is blocked.
3. From then on, merges into `staging` deploy to the demo box.

A consequence worth remembering: it is always **main's copy** of `deploy.yml` that runs.
Editing the deploy workflow on `staging` changes nothing until it is promoted.

## Ongoing deploys

Merging does not deploy. The deploy workflow triggers on the **CI workflow completing
successfully** for the branch, so nothing ships whose tests have not passed.

```
CI green on staging → build images → push ghcr :<sha> and :staging → ssh demo VPS → pull, up -d
CI green on main    → build images → push ghcr :<sha> and :latest  → ssh prod VPS → pull, up -d
```

Secrets are scoped to GitHub Environments named `staging` and `production`, so both
environments use the same names and the workflow needs no branching logic:
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, and `DEPLOY_HOST_FINGERPRINT`. Keys are
per-host, so a compromised staging key does not reach production. Giving `production` a
required reviewer later is a settings change, not a workflow change.

`DEPLOY_HOST_FINGERPRINT` pins the server's host key. Without it the SSH step accepts
any key it is offered, so whoever manages to answer on `DEPLOY_HOST` receives a session
with the deploy key in it.

The action wants a `SHA256:…` fingerprint, **not** a `known_hosts` line — `ssh-keyscan`
alone emits the wrong thing and the deploy fails host key verification. Read it off the
box itself, over the provider's console rather than over SSH, since trusting whatever
answers on the network is the attack this is meant to stop:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub | cut -d' ' -f2
```

The deploy also refreshes `compose.yaml` and the `Caddyfile` on the server from the
commit being deployed. Without that, a change to either would deploy nowhere and warn
about nothing — the running stack would drift from the repository silently.

## Rollback

Images are tagged with the commit SHA, so rolling back is picking an older one:

```bash
cd /opt/fitmybike
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<previous-sha>|' .env
docker compose pull && docker compose up -d
```

Writing it into `.env` rather than passing it inline is what makes it survive a reboot —
otherwise the stack comes back on whatever `latest` points at. Note this rolls back **code
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
