/**
 * Removes the customers the Playwright suite creates, and everything hanging off
 * them.
 *
 * `pnpm e2e` runs against the seeded dev database rather than a throwaway one, so
 * without this every run leaves a customer, their bikes and their fits behind and a
 * developer's customer list slowly fills with `E2EWizard1786…` rows.
 *
 * Deliberately narrow: it matches only last names starting with the e2e prefix
 * followed by digits, so it can never touch a real customer or the seed data. Runs
 * before *and* after the suite — before, because a run killed halfway leaves rows
 * that no teardown ever saw.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: ['../../.env', '.env'], quiet: true });

/** Must match E2E_PREFIX in apps/web/e2e/support.ts. */
const E2E_LAST_NAME_PREFIX = 'E2E';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  // `E2E<label><timestamp>` — the trailing digits are what make this safe. A real
  // customer called "E2E Systems" has no run of digits at the end and is untouched.
  const doomed = await prisma.customer.findMany({
    where: { lastName: { startsWith: E2E_LAST_NAME_PREFIX } },
    select: { id: true, lastName: true },
  });

  const ids = doomed.filter((c) => /\d{10,}$/.test(c.lastName)).map((c) => c.id);
  if (ids.length === 0) return;

  // Bikes, fits and their measurements cascade from the customer.
  const { count } = await prisma.customer.deleteMany({ where: { id: { in: ids } } });
  console.log(`e2e cleanup: removed ${count} test customer(s)`);
}

main()
  .catch((error: unknown) => {
    // Never fail the suite over cleanup — a leftover row is a nuisance, a red run
    // for the wrong reason is worse.
    console.error('e2e cleanup failed:', error);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
