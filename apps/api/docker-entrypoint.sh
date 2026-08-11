#!/bin/sh
set -e

# Migrations run on container start, before the server accepts traffic. `migrate
# deploy` only applies committed migrations — it never generates or resets, so it
# is safe to run unattended on every boot and on every replica.
echo "Applying database migrations…"
pnpm exec prisma migrate deploy

echo "Starting API…"
exec node dist/main.js
