import { test, expect } from '@playwright/test';
// Destructive scenario: run only with a disposable database and fixture account.
const username = process.env.ADMIN_TEST_USERNAME;
const password = process.env.ADMIN_TEST_PASSWORD;
const orderNumber = process.env.ADMIN_DELETE_TEST_ORDER;
test('administrator cancels, then confirms order deletion and sees refreshed totals', async ({
  page,
}) => {
  test.skip(
    !username || !password || !orderNumber,
    'Requires a disposable order and administrator fixture.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/admin');
  await page.getByLabel('Логін', { exact: true }).fill(username!);
  await page.getByLabel('Пароль', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Увійти до панелі' }).click();
  const remove = page.getByRole('button', {
    name: `Видалити замовлення ${orderNumber}`,
    exact: true,
  });
  await expect(remove).toBeVisible();
  await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Видалити замовлення?' });
  await expect(dialog).toContainText(orderNumber!);
  await dialog.getByRole('button', { name: 'Скасувати' }).click();
  await expect(remove).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await remove.click();
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/admin-delete-confirm.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Так, видалити' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Замовлень поки немає' }),
  ).toBeVisible();
  const stats = await page.request.get('/api/admin/stats');
  expect((await stats.json()).data).toMatchObject({
    orders: 0,
    recentOrders: 0,
    orderTotal: '0.00',
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Замовлень поки немає' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
