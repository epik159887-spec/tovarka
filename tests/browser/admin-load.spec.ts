import { test, expect } from '@playwright/test';
test('admin opens without authentication when shared exports are current', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/admin/session', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'ADMIN_REQUIRED', message: 'Увійдіть' },
      }),
    }),
  );
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Раді бачити вас.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('failed admin module shows a recovery screen and reload restores login', async ({
  page,
}) => {
  await page.route('**/api/admin/session', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'ADMIN_REQUIRED', message: 'Увійдіть' },
      }),
    }),
  );
  // Simulate a failed lazy import without contacting a database or changing files.
  const moduleRoute = '**/src/admin/AdminPage.tsx*';
  await page.route(moduleRoute, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "throw new Error('Simulated stale admin module');",
    }),
  );
  await page.goto('/admin');
  await expect(page.getByRole('alert')).toContainText(
    'Не вдалося завантажити сторінку',
  );
  await page.unroute(moduleRoute);
  await page
    .getByRole('button', { name: 'Оновити сторінку', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Раді бачити вас.' }),
  ).toBeVisible();
});
