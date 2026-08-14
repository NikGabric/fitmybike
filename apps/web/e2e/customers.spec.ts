import { expect, test } from '@playwright/test';
import { OTHER_ORG_OWNER, OWNER, login, testLastName } from './support';

test('rejects bad credentials without leaving the login page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', OWNER.email);
  await page.fill('#password', 'wrong-password');
  await page.click('[data-testid="login-submit"]');

  await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password');
  await expect(page).toHaveURL(/\/login/);
});

test('redirects an anonymous visitor to login', async ({ page }) => {
  await page.goto('/customers');
  await expect(page).toHaveURL(/\/login/);
});

test('creates, edits and archives a customer', async ({ page }) => {
  const lastName = testLastName('Customer');

  await login(page, OWNER);
  await expect(page.getByTestId('customers-table')).toContainText('Horvat');

  // --- create, entering cm/kg as a fitter would ---
  await page.getByTestId('new-customer').click();
  await page.getByTestId('firstName').fill('Ivana');
  await page.getByTestId('lastName').fill(lastName);
  await page.getByTestId('email').fill('ivana.e2e@example.com');
  await page.getByTestId('heightCm').fill('172.5');
  await page.getByTestId('save').click();

  // Saving lands on the customer, not back in the list.
  await expect(page).toHaveURL(/\/customers\/[^/]+$/);
  await expect(page.getByTestId('customer-name')).toHaveText(`Ivana ${lastName}`);
  // 172.5 cm entered -> stored as 1725 mm -> rendered back as 172.5 cm.
  await expect(page.getByText('172.5 cm')).toBeVisible();

  // --- edit ---
  await page.getByTestId('edit-customer').click();
  await expect(page.getByTestId('firstName')).toHaveValue('Ivana');
  await page.getByTestId('firstName').fill('Ivana-Maria');
  await page.getByTestId('save').click();

  await expect(page.getByTestId('customer-name')).toHaveText(`Ivana-Maria ${lastName}`);

  await page.goto('/customers');
  await page.getByTestId('customer-search').fill(lastName);
  const row = page.locator('tbody tr').filter({ hasText: lastName });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Ivana-Maria');

  // --- archive ---
  page.once('dialog', (dialog) => void dialog.accept());
  await page
    .locator('tbody tr')
    .filter({ hasText: lastName })
    .getByRole('button', { name: /Archive/ })
    .click();

  await expect(page.getByTestId('customers-empty')).toBeVisible();
});

test('shows a validation error for an implausible height', async ({ page }) => {
  await login(page, OWNER);
  await page.getByTestId('new-customer').click();

  await page.getByTestId('firstName').fill('Too');
  await page.getByTestId('lastName').fill('Small');
  await page.getByTestId('heightCm').fill('20');
  await page.getByTestId('save').click();

  await expect(page.getByText('Height must be between 100 and 250 cm')).toBeVisible();
  await expect(page).toHaveURL(/\/customers\/new/);
});

test('one organization never sees another organization’s customers', async ({ page }) => {
  await login(page, OWNER);
  await expect(page.getByTestId('customers-table')).toContainText('Horvat');
  // Klara Oblak belongs to Alpine Bike Lab.
  await expect(page.getByTestId('customers-table')).not.toContainText('Oblak');

  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, OTHER_ORG_OWNER);
  await expect(page.getByTestId('customers-table')).toContainText('Oblak');
  await expect(page.getByTestId('customers-table')).not.toContainText('Horvat');
});
