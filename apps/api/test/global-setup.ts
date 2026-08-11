import { execFileSync } from 'node:child_process';
import { config as loadEnv } from 'dotenv';

/**
 * Points the whole test run at TEST_DATABASE_URL and rebuilds its schema from
 * scratch. `db push --force-reset` rather than `migrate reset` so the run does not
 * execute the dev seed — tests create exactly the rows they need.
 */
export default function setup(): void {
  loadEnv({ path: ['../../.env', '.env'], quiet: true });

  const testUrl = process.env['TEST_DATABASE_URL'];
  if (!testUrl) throw new Error('TEST_DATABASE_URL must be set to run the API tests');

  process.env['DATABASE_URL'] = testUrl;
  process.env['NODE_ENV'] = 'test';

  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--force-reset'], {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
