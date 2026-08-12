import { expect, test, type Page } from '@playwright/test';

const OWNER = { email: 'owner@fitmybike.test', password: 'changeme123' };
const OTHER_ORG_OWNER = { email: 'owner@alpinelab.test', password: 'changeme123' };

async function login(page: Page, user: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/customers/);
}

/** Creates a customer and returns the detail page URL. */
async function createCustomer(page: Page, lastName: string): Promise<string> {
  await page.goto('/customers');
  await page.getByTestId('new-customer').click();
  await page.getByTestId('firstName').fill('Fit');
  await page.getByTestId('lastName').fill(lastName);
  await page.getByTestId('save').click();
  await expect(page.getByTestId('customer-name')).toHaveText(`Fit ${lastName}`);
  return page.url();
}

test('walks a full fit from body measurements to a completed comparison', async ({ page }) => {
  const lastName = `Wizard${Date.now()}`;

  await login(page, OWNER);
  const customerUrl = await createCustomer(page, lastName);

  // --- add a bike ---
  await expect(page.getByTestId('bikes-empty')).toBeVisible();
  await page.getByTestId('add-bike').click();
  await page.getByTestId('bike-brand').fill('Cervelo');
  await page.getByTestId('bike-model').fill('Caledonia');
  await page.getByTestId('save-bike').click();

  await expect(page).toHaveURL(customerUrl);
  await expect(page.getByTestId('bikes-list')).toContainText('Cervelo Caledonia');

  // --- start the fit ---
  await page.getByRole('button', { name: 'Start fit' }).click();
  await expect(page).toHaveURL(/\/fits\/[^/]+$/);
  await expect(page.getByTestId('step-BODY')).toHaveAttribute('aria-current', 'step');

  // --- body ---
  // Blank until something is actually saved, so "Saved" below means it.
  await expect(page.getByTestId('save-state')).toHaveText('');
  await page.getByTestId('m-inseam').fill('845');
  await page.getByTestId('m-shoulder_width').fill('425');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  await page.getByTestId('fit-next').click();

  // --- bike as it arrived ---
  await expect(page.getByTestId('step-BIKE_BEFORE')).toHaveAttribute('aria-current', 'step');
  await page.getByTestId('m-saddle_height').fill('715');
  await page.getByTestId('m-stem_length').fill('100');
  // 172.5 is why crank length is stored in tenths of a millimetre.
  await page.getByTestId('m-crank_length').fill('172.5');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  await page.getByTestId('fit-next').click();

  // --- bike as delivered ---
  await expect(page.getByTestId('step-BIKE_AFTER')).toHaveAttribute('aria-current', 'step');
  await page.getByTestId('m-saddle_height').fill('730');
  await page.getByTestId('m-stem_length').fill('90');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');

  await page.getByTestId('fit-next').click();

  // --- review: old and new side by side ---
  const saddleRow = page.getByTestId('row-saddle_height');
  await expect(saddleRow).toContainText('715 mm');
  await expect(saddleRow).toContainText('730 mm');
  await expect(saddleRow).toContainText('+15 mm');

  const stemRow = page.getByTestId('row-stem_length');
  await expect(stemRow).toContainText('-10 mm');

  // Recorded before but never changed: it still appears, with no delta.
  await expect(page.getByTestId('row-crank_length')).toContainText('172.5 mm');

  await page.getByTestId('fit-summary').fill('Raised the saddle, shortened the stem.');
  await page.getByTestId('fit-complete').click();

  // --- back on the customer, with history ---
  await expect(page).toHaveURL(customerUrl);
  await expect(page.getByTestId('fits-table')).toContainText('Cervelo Caledonia');
  await expect(page.getByTestId('fits-table')).toContainText('Completed');
});

test('resumes an interrupted fit on the step it was left on', async ({ page }) => {
  const lastName = `Resume${Date.now()}`;

  await login(page, OWNER);
  await createCustomer(page, lastName);

  await page.getByTestId('add-bike').click();
  await page.getByTestId('bike-brand').fill('Trek');
  await page.getByTestId('save-bike').click();

  await page.getByRole('button', { name: 'Start fit' }).click();
  await expect(page).toHaveURL(/\/fits\/[^/]+$/);
  const fitUrl = page.url();

  await page.getByTestId('m-inseam').fill('800');
  await page.getByTestId('fit-next').click();
  await expect(page.getByTestId('step-BIKE_BEFORE')).toHaveAttribute('aria-current', 'step');

  // Close the laptop mid-fit and come back to it.
  await page.goto('/customers');
  await page.goto(fitUrl);

  await expect(page.getByTestId('step-BIKE_BEFORE')).toHaveAttribute('aria-current', 'step');
  await page.getByTestId('step-BODY').click();
  await expect(page.getByTestId('m-inseam')).toHaveValue('800');
});

test('carries the previous fit’s delivered values into the next one', async ({ page }) => {
  const lastName = `Repeat${Date.now()}`;

  await login(page, OWNER);
  const customerUrl = await createCustomer(page, lastName);

  await page.getByTestId('add-bike').click();
  await page.getByTestId('bike-brand').fill('Specialized');
  await page.getByTestId('save-bike').click();

  // --- first fit, delivered at 740 ---
  await page.getByRole('button', { name: 'Start fit' }).click();
  await page.getByTestId('step-BIKE_AFTER').click();
  await page.getByTestId('m-saddle_height').fill('740');
  await expect(page.getByTestId('save-state')).toHaveText('Saved');
  await page.getByTestId('step-REVIEW').click();
  await page.getByTestId('fit-complete').click();
  await expect(page).toHaveURL(customerUrl);

  // --- second fit on the same bike ---
  await page.getByRole('button', { name: 'Start fit' }).click();
  await page.getByTestId('step-BIKE_BEFORE').click();

  await expect(page.getByTestId('m-saddle_height')).toHaveValue('740');
  await expect(page.getByTestId('inherited-saddle_height')).toBeVisible();
});

test('rejects an implausible measurement before it reaches the server', async ({ page }) => {
  const lastName = `Range${Date.now()}`;

  await login(page, OWNER);
  await createCustomer(page, lastName);

  await page.getByTestId('add-bike').click();
  await page.getByTestId('bike-brand').fill('Giant');
  await page.getByTestId('save-bike').click();

  await page.getByRole('button', { name: 'Start fit' }).click();
  await page.getByTestId('step-BIKE_BEFORE').click();

  // A 3 metre crank. Bounds come from the catalog definition.
  await page.getByTestId('m-crank_length').fill('3000');
  await expect(page.getByText('Must be between 150 and 185 mm')).toBeVisible();
});

test('one organization never sees another organization’s fits', async ({ page }) => {
  await login(page, OWNER);
  await page.getByTestId('customer-search').fill('Horvat');
  await page.locator('tbody tr').filter({ hasText: 'Horvat' }).getByRole('link').first().click();

  // Seeded history for Marko Horvat in Fit My Bike Studio.
  await expect(page.getByTestId('fits-table')).toContainText('Canyon Ultimate CF SL');
  const leakedUrl = await page
    .getByTestId('fits-table')
    .getByRole('link')
    .first()
    .getAttribute('href');
  expect(leakedUrl).toBeTruthy();

  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);

  // The other studio must not be able to open it even with the URL in hand.
  await login(page, OTHER_ORG_OWNER);
  await page.goto(leakedUrl as string);
  await expect(page.getByTestId('fit-error')).toBeVisible();
});
