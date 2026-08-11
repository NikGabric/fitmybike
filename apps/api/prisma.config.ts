import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Single source of truth is the repo-root .env. Root package.json scripts already
// inject it via dotenv-cli; this makes `pnpm exec prisma ...` from apps/api work too.
// dotenv never overwrites variables that are already set, so the two can't disagree.
loadEnv({ path: ['../../.env', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
