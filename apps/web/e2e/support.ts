/**
 * Every customer an e2e test creates gets a last name starting with this prefix.
 *
 * `pnpm e2e` drives the seeded *dev* database, so anything a test creates is
 * something a developer then sees in their own customer list. The prefix is what
 * lets the cleanup in playwright.config.ts find those rows again — and only those.
 * It must match E2E_LAST_NAME_PREFIX in apps/api/prisma/e2e-cleanup.ts.
 */
export const E2E_PREFIX = 'E2E';

/** A last name unique to this test run, and recognisable as disposable. */
export function testLastName(label: string): string {
  return `${E2E_PREFIX}${label}${Date.now()}`;
}
