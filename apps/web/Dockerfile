# syntax=docker/dockerfile:1
# Build context is the REPO ROOT — the web app depends on @fitmybike/shared.

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# This is a workspace-wide install, so it runs the API's `postinstall`
# (`prisma generate`) even though the web image never touches Prisma. The schema
# therefore has to be present here too — without it the install fails outright and
# the web image cannot be built at all.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @fitmybike/shared build && pnpm --filter @fitmybike/web build

# --- runtime: static files + the /api reverse proxy that keeps everything same-origin ---
FROM nginx:1.29-alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
