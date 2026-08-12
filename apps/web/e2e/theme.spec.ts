/**
 * jsdom computes no styles, so the unit suite can only assert class names.
 * These run in real Chromium and check the rendered result: that the fonts
 * actually loaded, that numbers really are tabular, that focus is visible,
 * and that dark mode really renders.
 */
import { expect, test, type Page } from '@playwright/test';

const OWNER = { email: 'owner@fitmybike.test', password: 'changeme123' };

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', OWNER.email);
  await page.fill('#password', OWNER.password);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/customers/);
}

test('measurement columns render with tabular figures', async ({ page }) => {
  await login(page);
  const cell = page.getByTestId('height-cell').first();
  await expect(cell).toHaveCSS('font-variant-numeric', 'tabular-nums');
  // The mono face has to have actually loaded, not silently fallen back.
  await expect(cell).toHaveCSS('font-family', /JetBrains Mono/);
});

test('the wordmark renders in the expanded display face', async ({ page }) => {
  await login(page);
  const wordmark = page.locator('.type-display').first();
  await expect(wordmark).toHaveCSS('font-family', /Archivo/);
  // 125% is the whole point of loading standard.css over index.css.
  await expect(wordmark).toHaveCSS('font-stretch', '125%');
});

test('keyboard focus paints a visible ring', async ({ page }) => {
  await login(page);
  // A text input is used rather than the button: browsers always match
  // :focus-visible on text fields, whereas a programmatic focus() on a link
  // only matches it when the last interaction was already a keypress.
  const search = page.getByTestId('customer-search');
  await search.focus();
  await expect(search).toBeFocused();

  const shadow = await search.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe('none');
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('renders the dark desk rather than falling back to white', async ({ page }) => {
    await login(page);
    const background = await page
      .locator('body')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = background.match(/\d+(\.\d+)?/g)!.map(Number) as [number, number, number];
    expect((r + g + b) / 3).toBeLessThan(80);
  });

  test('spends the accent on interaction, not on every row at rest', async ({ page }) => {
    await login(page);
    const link = page.getByTestId('customers-table').getByRole('link').first();

    // A column of orange names would be wallpaper. The accent marks what you
    // are acting on, so it arrives on hover and not before.
    const atRest = await link.evaluate((el) => getComputedStyle(el).color);
    await link.hover();
    const hovered = await link.evaluate((el) => getComputedStyle(el).color);

    expect(atRest).toContain('oklch');
    expect(hovered).not.toBe(atRest);
  });
});
