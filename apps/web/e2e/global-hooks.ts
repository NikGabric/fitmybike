import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * The suite creates customers in the seeded dev database, so it clears its own
 * rows on the way in and on the way out. On the way in as well because a run that
 * is interrupted — Ctrl-C, a crash, a killed CI job — never reaches its teardown.
 */
function cleanup(): void {
  execFileSync('pnpm', ['--filter', '@fitmybike/api', 'exec', 'tsx', 'prisma/e2e-cleanup.ts'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

export default cleanup;
