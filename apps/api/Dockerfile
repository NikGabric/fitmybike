# syntax=docker/dockerfile:1
# Build context is the REPO ROOT, not apps/api — the API depends on the
# @fitmybike/shared workspace package.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- dependencies (cached until a manifest changes) ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# The API's postinstall runs `prisma generate`, so the schema has to be here before
# the install rather than arriving with the source copy below — otherwise the
# install fails with no schema to generate from.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- build ---
FROM deps AS build
COPY . .
# Config validation runs at import time; the real URL is injected at runtime.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN pnpm --filter @fitmybike/shared build \
  && pnpm --filter @fitmybike/api exec prisma generate \
  && pnpm --filter @fitmybike/api build

# --- runtime ---
FROM base AS runner
ENV NODE_ENV=production
# The whole built workspace is carried over rather than pruned: pnpm's symlinked
# node_modules does not survive naive copying, and `pnpm deploy` adds moving parts
# for little gain at this size. Revisit if image size becomes a problem.
COPY --from=build /app /app
WORKDIR /app/apps/api

RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000
COPY --chown=app:app apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/bin/sh", "/usr/local/bin/entrypoint.sh"]
