import { expect, type Page } from '@playwright/test';

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

export const OWNER = { email: 'owner@fitmybike.test', password: 'changeme123' };
export const OTHER_ORG_OWNER = { email: 'owner@alpinelab.test', password: 'changeme123' };

let clientCounter = 0;

/**
 * Logs in, from an address unique to this call.
 *
 * Login is rate limited per address. The suite logs in roughly eighteen times in a
 * couple of minutes, and every request would otherwise arrive from the same loopback
 * address — so the sixth would begin failing with 429 and everything after it would
 * sit on /login, which reads as the app being broken rather than the limit working.
 * Each test is its own client, so each gets its own address.
 *
 * 192.0.2.0/24 is TEST-NET-1, reserved for documentation. The dev server sits behind
 * Vite's proxy, and `trust proxy` in configure-app.ts is what lets the API read this.
 */
export async function login(
  page: Page,
  user: { email: string; password: string } = OWNER,
): Promise<void> {
  clientCounter += 1;
  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `192.0.2.${(clientCounter % 253) + 1}` });

  await page.goto('/login');
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/customers/);
}
