# Staging Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing production compose stack deployable to a staging VPS over HTTPS, deployed automatically when CI passes on `staging`.

**Architecture:** Caddy joins the compose stack as the only published service and terminates TLS, reverse-proxying to the existing nginx `web` container. Nothing inside the stack changes, so the single-origin design that makes cookies first-party and CORS unnecessary is untouched. Images are built by GitHub Actions and pushed to GHCR; the server only pulls. One Caddyfile serves both a real hostname (automatic TLS) and a local dry run (plain HTTP) by taking its site address from an environment variable.

**Tech Stack:** Docker Compose, Caddy 2, GitHub Actions, GHCR, Prisma 7 (migrations run in the API entrypoint), Vitest.

**Spec:** `docs/deployment.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Never push to `staging` or `main`.** Work on a branch, open a PR against `staging`, squash merge.
- **Nothing inside the stack changes.** `apps/web/nginx.conf` keeps `proxy_pass http://api:3000`. No application source is modified except the one seed change in Task 1. If a step makes you reach for `enableCors()`, stop — the topology has broken.
- **No secret values in the repo.** Hostnames, SSH keys and passwords live in GitHub Environments and the server's `.env`. `.env.example` gets names and dev-safe defaults only.
- **The GHCR image names are exactly** `ghcr.io/nikgabric/fitmybike-api` and `ghcr.io/nikgabric/fitmybike-web` (lowercase — GHCR rejects uppercase owners).
- **The CI workflow is named `CI`** (`.github/workflows/ci.yml`, `name: CI`). The deploy workflow's `workflow_run.workflows` value must match that string exactly or it silently never fires.
- **Migrations are not a deploy step.** `apps/api/docker-entrypoint.sh` already runs `prisma migrate deploy` before the server starts, on every boot.
- `pnpm verify` must stay green. No task may require `pnpm openapi`, since none touches a shared schema or controller signature.

## What this plan cannot do

Tasks 1–4 are repo changes and are fully verifiable locally. **Task 5 is an operator runbook that an agent cannot execute** — it needs a VPS, a domain, DNS control, and write access to GitHub repository settings. It is written as exact commands for a human to run, and it is the only task that touches anything outside the repository.

Do not attempt Task 5 automatically. Stop after Task 4 and hand over.

## File structure

| File | Responsibility |
| --- | --- |
| `apps/api/prisma/seed-password.ts` | **new** — resolves the seed password from the environment. Pure, no side effects, so it can be unit tested without executing the seed. |
| `apps/api/test/seed-password.spec.ts` | **new** — unit tests for the above. |
| `apps/api/prisma/seed.ts` | modify — use the resolver; stop printing a real password to logs. |
| `Caddyfile` | **new** — one site block, address from `$SITE_ADDRESS`. |
| `compose.yaml` | modify — add `caddy`, add `image:` tags, stop publishing `web`. |
| `.env.example` | modify — document the deployment variables. |
| `.github/workflows/ci.yml` | modify — run CI on pushes to `staging`, not just `main`. |
| `.github/workflows/deploy.yml` | **new** — build, push, deploy on CI success. |
| `docs/deployment.md` | modify — replace placeholder names with the real variables and commands. |

---

### Task 1: Seed password from the environment

The seed hardcodes `changeme123`. On a public staging URL that is the only thing in front of the demo data, so it has to be settable. Extracted into its own module because importing `seed.ts` executes it — a test cannot import the current file without seeding a database as a side effect.

**Files:**
- Create: `apps/api/prisma/seed-password.ts`
- Create: `apps/api/test/seed-password.spec.ts`
- Modify: `apps/api/prisma/seed.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveSeedPassword(env?: NodeJS.ProcessEnv): string` and `DEFAULT_SEED_PASSWORD: string`, both from `apps/api/prisma/seed-password.ts`. No later task uses them.

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/seed-password.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED_PASSWORD, resolveSeedPassword } from '../prisma/seed-password';

describe('resolveSeedPassword', () => {
  it('falls back to the development default when SEED_PASSWORD is unset', () => {
    expect(resolveSeedPassword({})).toBe(DEFAULT_SEED_PASSWORD);
  });

  it('uses SEED_PASSWORD when it is set', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: 'a-real-password' })).toBe('a-real-password');
  });

  // An empty or whitespace-only value in a .env file is a mistake, not an intent
  // to use "" as a password — treat it as unset rather than seeding an account
  // whose password is a single space.
  it('treats a blank SEED_PASSWORD as unset', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: '   ' })).toBe(DEFAULT_SEED_PASSWORD);
  });

  it('does not trim a password that has meaningful surrounding characters', () => {
    expect(resolveSeedPassword({ SEED_PASSWORD: ' pad ded ' })).toBe('pad ded');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @fitmybike/api exec vitest run test/seed-password.spec.ts`

Expected: FAIL — `Cannot find module '../prisma/seed-password'`.

- [ ] **Step 3: Write the module**

Create `apps/api/prisma/seed-password.ts`:

```ts
/**
 * The password every account the seed creates is given.
 *
 * Kept in its own module because importing `seed.ts` runs it: the seed executes on
 * import, so a test cannot reach this logic without writing to a database.
 */

/** Used when SEED_PASSWORD is unset. Fine for local development, not for a public URL. */
export const DEFAULT_SEED_PASSWORD = 'changeme123';

export function resolveSeedPassword(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env['SEED_PASSWORD']?.trim();
  return configured ? configured : DEFAULT_SEED_PASSWORD;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @fitmybike/api exec vitest run test/seed-password.spec.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Use it in the seed**

In `apps/api/prisma/seed.ts`, add the import beside the existing ones:

```ts
import { DEFAULT_SEED_PASSWORD, resolveSeedPassword } from './seed-password';
```

Replace the line `const DEFAULT_PASSWORD = 'changeme123';` with:

```ts
const DEFAULT_PASSWORD = resolveSeedPassword();
```

- [ ] **Step 6: Stop printing a real password to the logs**

The seed ends by printing login instructions containing the password. With `SEED_PASSWORD` set that writes a live credential into terminal scrollback and CI logs. In `apps/api/prisma/seed.ts`, replace the two `console.log` lines inside the final `for (const org of ORGS)` loop with:

```ts
    // Only echo the password when it is the well-known development default.
    // Printing a real one would put a live credential in CI logs.
    const shown = DEFAULT_PASSWORD === DEFAULT_SEED_PASSWORD ? DEFAULT_PASSWORD : '$SEED_PASSWORD';
    console.log(`  ${org.owner.email} / ${shown}   (OWNER, ${org.name})`);
    if (org.fitter) console.log(`  ${org.fitter.email} / ${shown}   (FITTER, ${org.name})`);
```

- [ ] **Step 7: Verify the seed still runs and still prints the default locally**

Run: `pnpm db:seed`

Expected: succeeds, and prints `owner@fitmybike.test / changeme123` — because `SEED_PASSWORD` is not set locally.

- [ ] **Step 8: Verify a set password is honoured and not echoed**

Run: `SEED_PASSWORD=hunter2-not-real pnpm db:seed`

Expected: succeeds, prints `owner@fitmybike.test / $SEED_PASSWORD`, and the literal `hunter2-not-real` appears nowhere in the output.

Note this does **not** change the existing local password: the seed's `upsert` updates `name`, `role` and `organizationId` but never `passwordHash`, so an account that already exists keeps its old one. That is expected and documented.

- [ ] **Step 9: Document the variable**

In `.env.example`, add below the `SESSION_TTL_DAYS` line:

```bash
# Password given to every account `pnpm db:seed` creates. Unset means changeme123,
# which is fine locally and not fine on a public URL. Only takes effect on a database
# that does not already have the account — the seed never updates an existing password.
# SEED_PASSWORD=
```

- [ ] **Step 10: Commit**

```bash
git add apps/api/prisma/seed-password.ts apps/api/test/seed-password.spec.ts \
        apps/api/prisma/seed.ts .env.example
git commit -m "feat(api): let the seed password come from the environment"
```

---

### Task 2: Caddy, and the compose stack it fronts

**Files:**
- Create: `Caddyfile`
- Modify: `compose.yaml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: the environment variables `SITE_ADDRESS`, `CADDY_HTTP_PORT`, `CADDY_HTTPS_PORT` and `IMAGE_TAG`, which Task 4 sets on the server, and the image names `ghcr.io/nikgabric/fitmybike-{api,web}`, which Task 4 pushes to.

- [ ] **Step 1: Write the Caddyfile**

Create `Caddyfile` at the repository root:

```caddyfile
# One site block, two uses. Set SITE_ADDRESS to a hostname
# (https://fit.example.com) and Caddy obtains and renews a certificate by itself;
# set it to ":80" and Caddy serves plain HTTP, which is what makes a local dry run
# of the production stack possible without a domain.
#
# It proxies to the nginx `web` container rather than to the API. nginx keeps
# serving the SPA and proxying /api to http://api:3000, so the browser still sees
# exactly one origin and no CORS is involved anywhere.
{$SITE_ADDRESS} {
	encode zstd gzip
	reverse_proxy web:80
}
```

- [ ] **Step 2: Add the caddy service to compose.yaml**

In `compose.yaml`, add this service after the `web` service:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '${CADDY_HTTP_PORT:-80}:80'
      - '${CADDY_HTTPS_PORT:-443}:443'
    environment:
      SITE_ADDRESS: ${SITE_ADDRESS:?set SITE_ADDRESS}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      # Certificates live here. Without these volumes Caddy re-issues on every
      # deploy and will hit Let's Encrypt rate limits within a day.
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
```

- [ ] **Step 3: Add the volumes**

In `compose.yaml`, extend the `volumes:` block at the bottom:

```yaml
volumes:
  fitmybike_pgdata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 4: Stop publishing the web container**

In `compose.yaml`, delete these two lines from the `web` service:

```yaml
    ports:
      - '${WEB_PORT:-8080}:80'
```

Caddy reaches `web` on the compose network. Leaving the port published would keep a plaintext copy of the app open beside the HTTPS one.

- [ ] **Step 5: Add image names so the server can pull instead of build**

In `compose.yaml`, add an `image:` line to `api`, directly above its `build:` key:

```yaml
    image: ghcr.io/nikgabric/fitmybike-api:${IMAGE_TAG:-latest}
```

and the same for `web`:

```yaml
    image: ghcr.io/nikgabric/fitmybike-web:${IMAGE_TAG:-latest}
```

Keeping `build:` alongside means `docker compose up --build` still works locally; the server uses `docker compose pull`, which needs the image name.

- [ ] **Step 6: Document the new variables**

In `.env.example`, append:

```bash
# --- Deployment (staging/production; see docs/deployment.md) ---
# Caddy's site address. A hostname turns on automatic TLS. ":80" serves plain HTTP,
# which is what a local dry run of the production stack uses.
SITE_ADDRESS=:80
# What Caddy publishes on the host. 80 and 443 on a server; unprivileged locally.
CADDY_HTTP_PORT=8080
CADDY_HTTPS_PORT=8443
# Which image tag is deployed. CI rewrites this on the server to the commit SHA;
# set it by hand to roll back.
IMAGE_TAG=latest
```

- [ ] **Step 7: Verify the compose file parses and interpolates**

Run: `docker compose --env-file .env.example config >/dev/null && echo OK`

Expected: `OK`. This catches typos, the missing `SITE_ADDRESS`, and bad indentation before anything is built.

- [ ] **Step 8: Run the whole production stack locally**

This is the real verification — it proves the images build, migrations run on boot, and Caddy fronts the app. From a clean state:

```bash
cp .env.example .env.dryrun
docker compose --env-file .env.dryrun up -d --build
```

Wait for the API to report healthy, then:

```bash
docker compose --env-file .env.dryrun logs api | grep "Applying database migrations"
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/health
```

Expected: the migration line is present, and both curls return `200`. The second one is the important one — it proves Caddy → nginx → api works and `/api` is still same-origin.

**Do not try to log in during the dry run.** `compose.yaml` sets `NODE_ENV=production`, which makes the session cookie `Secure`, and a browser will not return a `Secure` cookie over the dry run's plain HTTP. Login failing here is correct behaviour, not a bug — it is the same setting that makes the cookie safe once Caddy has a real certificate. Logging in is verified against the real HTTPS host in Task 5.

- [ ] **Step 9: Tear the dry run down**

```bash
docker compose --env-file .env.dryrun down -v
rm .env.dryrun
```

`-v` removes the volumes, including the dry run's database. Do not run this against a server.

- [ ] **Step 10: Commit**

```bash
git add Caddyfile compose.yaml .env.example
git commit -m "feat: terminate TLS with Caddy and pull images by tag"
```

---

### Task 3: Run CI on staging

`.github/workflows/ci.yml` currently triggers on `pull_request` and `push: branches: [main]`. Merging to `staging` would run nothing, so the deploy workflow in Task 4 — which triggers on CI completing — would never fire. This is a one-line change but it gates the whole pipeline.

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: a completed `CI` workflow run on pushes to `staging`, which Task 4's `workflow_run` trigger listens for.

- [ ] **Step 1: Add staging to the push trigger**

In `.github/workflows/ci.yml`, change:

```yaml
  push:
    branches: [main]
```

to:

```yaml
  push:
    # Both deployable branches. Without staging here, merging to it runs no CI and
    # the deploy workflow — which triggers on a completed CI run — never fires.
    branches: [main, staging]
```

- [ ] **Step 2: Verify the workflow is still valid YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"`

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run on pushes to staging as well as main"
```

---

### Task 4: The deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: the `CI` workflow name from Task 3; the image names and `IMAGE_TAG` variable from Task 2.
- Produces: images at `ghcr.io/nikgabric/fitmybike-{api,web}` tagged with the commit SHA and the branch name, and a deployed stack. Requires the GitHub Environments and secrets created in Task 5.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

# Triggered by CI finishing, not by the push itself: a push-triggered deploy would
# ship commits whose tests never ran, which defeats the gate CI exists to provide.
# `workflows` must match the CI workflow's `name:` exactly or this silently never
# fires.
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [staging, main]

permissions:
  contents: read
  packages: write

concurrency:
  group: deploy-${{ github.event.workflow_run.head_branch }}
  cancel-in-progress: false

jobs:
  deploy:
    # `types: [completed]` fires for failures too.
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    # Secrets are scoped per environment, so both use the same names and production
    # can be given a required reviewer without touching this file.
    environment: ${{ github.event.workflow_run.head_branch == 'main' && 'production' || 'staging' }}

    env:
      SHA: ${{ github.event.workflow_run.head_sha }}
      BRANCH: ${{ github.event.workflow_run.head_branch }}

    steps:
      # Check out the exact commit CI passed on, not the branch tip, which may
      # already have moved.
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push the API image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/api/Dockerfile
          push: true
          tags: |
            ghcr.io/nikgabric/fitmybike-api:${{ env.SHA }}
            ghcr.io/nikgabric/fitmybike-api:${{ env.BRANCH }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push the web image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: |
            ghcr.io/nikgabric/fitmybike-web:${{ env.SHA }}
            ghcr.io/nikgabric/fitmybike-web:${{ env.BRANCH }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          envs: SHA
          script: |
            set -e
            cd /opt/fitmybike
            # Persist the tag so a reboot brings back the same version rather than
            # whatever `latest` points at.
            if grep -q '^IMAGE_TAG=' .env; then
              sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${SHA}|" .env
            else
              echo "IMAGE_TAG=${SHA}" >> .env
            fi
            docker compose pull
            docker compose up -d
            docker image prune -f
```

- [ ] **Step 2: Verify it is valid YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('OK')"`

Expected: `OK`.

- [ ] **Step 3: Verify the workflow name it listens for actually matches**

Run: `grep -m1 '^name:' .github/workflows/ci.yml`

Expected: `name: CI` — the same string as `workflows: [CI]` in `deploy.yml`. A mismatch here produces a workflow that never runs and never errors, which is the single easiest way to lose an afternoon.

- [ ] **Step 4: Update the deployment doc with the real names**

In `docs/deployment.md`, replace the "Ongoing deploys" section's secret list with:

```markdown
Secrets are scoped to GitHub Environments named `staging` and `production`, so both
environments use the same three names and the workflow needs no branching logic:
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`. Keys are per-host, so a compromised
staging key does not reach production.
```

And replace the "Rollback" command block with:

```markdown
```bash
cd /opt/fitmybike
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=<previous-sha>|' .env
docker compose pull && docker compose up -d
```
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml docs/deployment.md
git commit -m "ci: build images and deploy when CI passes on a deployable branch"
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin HEAD
gh pr create --base staging --title "feat: deploy the staging stack over HTTPS" \
  --body "Implements docs/deployment.md. Caddy fronts the existing stack, images build in CI and the server pulls. Requires the server setup in the plan's Task 5 before the deploy step can succeed."
```

**Stop here.** Everything remaining needs a server.

---

### Task 5: Server and repository setup — OPERATOR ONLY

**An agent cannot do this.** It needs a VPS, a domain, DNS control and GitHub repository settings. Run it yourself, in order.

#### Creating the box

Not a numbered step because it is provider-specific, but it comes before Step 1. Any VPS
meeting these requirements works; the provider is not load-bearing.

| Requirement | Why |
| --- | --- |
| **amd64** | `deploy.yml` sets no `platforms:` on either build, so images are built for the runner's architecture. An Arm box pulls images it cannot run, and the failure surfaces at runtime on the server rather than in CI. Arm is possible — `runs-on: ubuntu-24.04-arm` is free on public repositories — but it is a workflow change, not a drop-in. |
| **4 GB RAM** | Postgres, the API, nginx and Caddy. 2 GB runs but leaves nothing spare. |
| **40 GB disk** | The images carry the whole workspace including devDependencies, and the deploy prunes only images older than 336h. |
| **Root SSH, ports 80/443 reachable** | The deploy is SSH-push, and ACME's HTTP challenge needs port 80 specifically. |
| **Ubuntu 24.04** | What Step 2's Docker install assumes. |

Whichever provider, two things at creation time:

- **Your own SSH public key**, not the deploy key. The deploy key is separate and is added
  in Step 5; a deploy should not share credentials with your own shell access.
- **A firewall allowing 22, 80 and 443 only.** Without one every port is open, and the
  seeded demo data behind this host is reachable by anyone who finds it.

  **Prefer the provider's firewall over ufw where one exists** (netcup and Hetzner both
  have one). Docker publishes ports by writing directly to iptables, ahead of ufw's
  chains, so ufw never sees traffic to a published port. A filter outside the VM cannot
  be bypassed that way. SSH must stay open to `*` — the deploy comes from GitHub-hosted
  runners, whose addresses range widely.

  netcup's is stateful **for TCP only**. Outbound TCP return traffic is handled
  automatically, but UDP has no connection tracking, so a restrictive incoming policy
  needs explicit rules for UDP source 53 (DNS) and source 123 (NTP) or those replies are
  dropped. A broken NTP is the quiet one: the clock drifts and Caddy's certificate
  validation starts failing weeks later. There is no lockout warning, so verify the
  port 22 rule and open a second session before trusting it.

  Where no provider firewall exists, use ufw on the host — installing it first, since
  minimal images omit it:

  ```bash
  sudo apt update && sudo apt install -y ufw
  sudo ufw default deny incoming && sudo ufw default allow outgoing
  sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443
  sudo ufw enable
  ```

  Order matters: allow 22 *before* enabling, or ufw closes the session you are typing in.
  Do not run both — two firewalls is two places to misconfigure.

Providers evaluated, August 2026, cheapest first:

| Provider | Spec | Price | Notes |
| --- | --- | --- | --- |
| RackNerd | 2 vCPU / 3.5 GB / 65 GB | ~$32/year | US only; annual prepay; small host |
| Contabo | 4 vCPU / 8 GB / ~100 GB | ~€4.50/mo | EU, monthly billing; check for a setup fee |
| **netcup VPS Lite 1 G12s** | 2 vCPU / 4 GB / 80 GB SSD | **€4.88/mo incl. VAT** | **Chosen.** EU (Nuremberg/Vienna/Amsterdam), x86. The Lite line trades NVMe for SSD and caps bandwidth, neither of which this workload notices. Avoid the separate ARM line. |
| netcup VPS 500 G12 | 2 vCPU / 4 GB / 128 GB NVMe | €5.91/mo incl. VAT | Same CPU and RAM as the Lite 1 for €1 more; the NVMe and full bandwidth buy nothing here. |
| netcup VPS nano G11s | 2 vCPU / 2 GB / 60 GB | €3.08/mo incl. VAT | Would run it — nothing builds on the box, so steady state is well under 2 GB — but older generation and no headroom. Add 2 GB of swap if used. |
| Hetzner CX23 | 2 vCPU / 4 GB / 40 GB | €5.49/mo excl. VAT | Best hardware, but stock and account verification both blocked this |

Avoided: DigitalOcean, Vultr and Linode share an automated signup risk model that rejects
accounts outright with no route through. PaaS (Fly, Railway, Render) is ruled out by the
single-origin topology — see "Topology" in `docs/deployment.md`.

Note the server's public IPv4 — Step 1 needs it.

- [ ] **Step 1: Point DNS at the box**

Create an `A` record for the hostname you will use (for example `fit.example.com`) pointing at the VPS's public IP. Verify before continuing — Caddy cannot get a certificate for a name that does not resolve to it:

```bash
dig +short fit.example.com
```

Expected: the VPS IP, and nothing else.

Prefer a subdomain that says what the box is — `demo.` or `staging.` — and leave the apex
and `app.` free. Staging and production are separate hosts, and the name chosen here ends
up in `APP_URL`, `SITE_ADDRESS` and a Let's Encrypt certificate.

- [ ] **Step 2: Install Docker on the VPS**

```bash
curl -fsSL https://get.docker.com | sh
docker compose version
```

If `DEPLOY_USER` is not root, it needs the docker group or every deploy fails on a
socket permission error:

```bash
sudo usermod -aG docker "$USER"
```

Log out and back in, then confirm it took effect without `sudo`:

```bash
docker ps
```

- [ ] **Step 3: Create the deploy directory and its three files**

**This step requires the deployment PR to be merged into `staging` first.** It downloads
`compose.yaml` and the `Caddyfile` from that branch, and until the merge the `Caddyfile`
does not exist there and `compose.yaml` has no `caddy` service — you get a 404 and a
stack with no TLS. Merging early is safe: nothing deploys until `deploy.yml` reaches
`main` in Step 7.

The server holds no source. Create the directory from an account with sudo, then hand it
to the deploy user — the deploy rewrites `IMAGE_TAG` in `.env` with `sed -i` on every run
and fails on a root-owned file:

```bash
sudo mkdir -p /opt/fitmybike && sudo chown -R deploy:deploy /opt/fitmybike
```

Then, **as `deploy`**:

```bash
cd /opt/fitmybike
curl -fsSLO https://raw.githubusercontent.com/NikGabric/fitmybike/staging/compose.yaml
curl -fsSLO https://raw.githubusercontent.com/NikGabric/fitmybike/staging/Caddyfile
```

- [ ] **Step 4: Write the server's .env**

Still on the VPS, in `/opt/fitmybike/.env`, **as the `deploy` user**. Generate the
passwords rather than choosing them.

`POSTGRES_PASSWORD` must be **hex, not base64**. `compose.yaml` interpolates it into
`DATABASE_URL` as `postgresql://user:PASSWORD@db:5432/...`, and base64's `/` truncates
the URL's authority section — Prisma then fails to connect with an error pointing at the
database rather than at the password.

```bash
cat > .env <<EOF
POSTGRES_USER=fitmybike
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=fitmybike
NODE_ENV=production
PORT=3000
SESSION_COOKIE_NAME=fmb_session
SESSION_TTL_DAYS=30
APP_URL=https://fit.example.com
SITE_ADDRESS=https://fit.example.com
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
IMAGE_TAG=staging
SEED_PASSWORD=$(openssl rand -base64 18)
EOF
chmod 600 .env
grep SEED_PASSWORD .env
```

Record the `SEED_PASSWORD` value — it is the only account you will be able to log in with. `APP_URL` and `SITE_ADDRESS` must both be the public HTTPS URL.

- [ ] **Step 5: Create a deploy key pair**

On your workstation:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/fitmybike-staging -N "" -C "fitmybike staging deploy"
ssh-copy-id -i ~/.ssh/fitmybike-staging.pub <user>@<vps-ip>
```

- [ ] **Step 6: Create the GitHub Environment and its secrets**

In the repository: **Settings → Environments → New environment → `staging`**. Add four environment secrets:

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | the VPS IP or hostname |
| `DEPLOY_USER` | the SSH user |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/fitmybike-staging` (the **private** key) |
| `DEPLOY_HOST_FINGERPRINT` | `SHA256:…`, read off the box via the provider console (see below) |

Get the fingerprint on the VPS itself, and read the **ECDSA** key — not Ed25519:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ecdsa_key.pub | cut -d' ' -f2
```

Two ways to get this wrong, both of which fail the deploy with an unhelpful error:

- `ssh-keyscan` emits a `known_hosts` line, which the action does not parse. It wants the
  `SHA256:…` form above.
- A stock Ubuntu host has RSA, ECDSA and Ed25519 host keys. OpenSSH prefers Ed25519, so
  that feels like the one to read — but the action wraps `drone-ssh`, written in Go, and
  Go's `x/crypto/ssh` orders `ecdsa-sha2-nistp256` ahead of `ssh-ed25519`. The server
  presents ECDSA; pinning Ed25519 fails with `ssh: handshake failed: ssh: host key
  fingerprint mismatch`.

To confirm which key a Go-order client is offered, no credentials needed:

```bash
ssh -v -o HostKeyAlgorithms=ecdsa-sha2-nistp256,ssh-ed25519 \
    -o BatchMode=yes nobody@<vps-ip> exit 2>&1 | grep 'Server host key'
```

The fingerprint pins the server's host key. Without it the SSH step accepts whatever key
it is offered, so anyone who can answer on `DEPLOY_HOST` — via DNS or a reassigned IP —
gets a session with your deploy key in it.

Do not create a `production` environment yet. Production is blocked on organization onboarding, and the deploy job is gated to `staging` until that changes.

- [ ] **Step 7: Promote `deploy.yml` to `main`**

The deploy workflow cannot fire while it exists only on `staging` — GitHub dispatches
`workflow_run` from the default branch's copy, and the default branch is `main`. The
deployment PR must already be merged into `staging` (Step 3 depends on it too); now open
and merge the promotion PR `staging` → `main` using a **merge commit, not a squash**.

Two repository settings block this, and neither announces itself:

- **`allow_merge_commit` must be enabled.** With only squash merging on, the promotion is
  simply unmergeable. Both are needed: squash for feature PRs, merge commit for promotions.
- **`delete_branch_on_merge` must be off for this merge**, or turn on branch protection
  for `staging` first. The promotion PR's head branch *is* `staging`, so auto-delete
  removes it on merge. Restore the setting afterwards so feature branches still clean up.

That promotion deploys nothing: the job is gated to `head_branch == 'staging'` while
production is blocked. It exists only to put the workflow where GitHub will look for it.

Nothing needs doing about GHCR visibility — the deploy logs the host in with the
workflow's own token, so the packages stay private and the box holds no registry
credential.

- [ ] **Step 8: Trigger and watch the first deploy**

The merge into `staging` happened before `deploy.yml` reached `main`, so its CI run could
not have fired a deploy. Re-run that CI run (`Actions → CI → the `staging` push run →
Re-run all jobs`) to produce a fresh completed run for `workflow_run` to trigger from.
Every merge after this one deploys by itself.

Expect two Deploy runs to appear and show **skipped** — those are the promotion's CI runs
on `main` being correctly rejected by the `head_branch == 'staging'` gate. Note that a
Deploy run always reports `main` as its own branch, because `workflow_run` workflows
execute from the default branch; the gate reads a different field from the event payload.

- [ ] **Step 9: Seed the database, once**

On the VPS, after the first deploy succeeds. **Verify the password reached the container
before seeding:**

```bash
cd /opt/fitmybike
docker compose exec -T api printenv SEED_PASSWORD   # must match .env
docker compose exec api pnpm seed
docker compose exec -T db psql -U fitmybike -d fitmybike -c 'select email, role from users;'
```

That check is load-bearing. The seed's upsert carries `passwordHash` in its `create`
branch only, so accounts created with the wrong password keep it permanently — re-seeding
does not correct it, and the only remedy is dropping the Postgres volume. Do that by name;
`docker compose down -v` would also discard `caddy_data` and the certificate with it.

This is a one-time bootstrap, not a deploy step. It creates the demo organizations and the
accounts, using the `SEED_PASSWORD` from `.env`. Until it runs, the `users` table is empty
and every login reports "invalid email or password" — the API does not distinguish an
unknown account from a wrong one.

- [ ] **Step 10: Verify the deployment end to end**

From your own machine:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://fit.example.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://fit.example.com/api/health
```

Expected: `200` from both, over HTTPS, with no certificate warning.

Then in a browser: open the site, confirm the padlock, log in as `owner@fitmybike.test` with your `SEED_PASSWORD`, open a customer, start a fit, enter a measurement, reload the page mid-wizard and confirm it resumes on the same step. That exercises the session cookie over HTTPS, the same-origin `/api` proxy, and the database in one pass.

---

## Verification summary

| Task | How you know it worked |
| --- | --- |
| 1 | `vitest run test/seed-password.spec.ts` — 4 passing; `SEED_PASSWORD=x pnpm db:seed` does not echo `x`. |
| 2 | `docker compose config` parses; the local stack answers `200` on `/` and `/api/health`. |
| 3 | `ci.yml` is valid YAML and lists `staging`. |
| 4 | `deploy.yml` is valid YAML; its `workflows:` value matches `ci.yml`'s `name:`. |
| 5 | `https://<host>/api/health` returns `200`; a fit can be walked in a browser. |

Run `pnpm verify` before opening the PR. Nothing in Tasks 1–4 should affect it, and if it goes red, something in Task 1 touched more than intended.
