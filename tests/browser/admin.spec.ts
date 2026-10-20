import { test, expect } from '@playwright/test';
const username = process.env.ADMIN_TEST_USERNAME;
const password = process.env.ADMIN_TEST_PASSWORD;
const productName =
  process.env.ADMIN_TEST_PRODUCT ?? 'Тестовий товар адмінпанелі';
const customerName = process.env.ADMIN_TEST_CUSTOMER ?? 'Тестова Покупчиня';
test('admin login, order details, photo upload, product creation and logout', async ({
  page,
}) => {
  test.skip(
    !username || !password,
    'Provide an isolated admin test account to run this scenario.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://localhost:5173/admin');
  await expect(
    page.getByRole('heading', { name: 'Раді бачити вас.' }),
  ).toBeVisible();
  await page.getByLabel('Логін', { exact: true }).fill(username!);
  await page.getByLabel('Пароль', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Увійти до панелі' }).click();
  await expect(
    page.getByRole('heading', { name: `Вітаємо, ${username}.` }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Пошук замовлень' })
    .fill(customerName);
  await expect(
    page.getByRole('cell', { name: customerName, exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Переглянути замовлення', exact: false })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('dialog').getByText(customerName, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Що замовили' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Закрити', exact: true }).click();
  await page.screenshot({
    path: 'test-results/admin-orders.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Додати товар', exact: true }).click();
  await page.getByLabel('Назва товару', { exact: true }).fill(productName);
  await page
    .getByLabel('Опис товару', { exact: true })
    .fill('Тестовий товар, створений через захищену адмінпанель.');
  await page.getByLabel('Ціна, грн', { exact: true }).fill('321,50');
  await page.getByLabel('Кількість на складі', { exact: true }).fill('7');
  await page
    .getByLabel('Категорія', { exact: true })
    .selectOption({ label: 'Кераміка' });
  const upload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/admin/uploads') &&
      response.request().method() === 'POST',
  );
  await page
    .locator('#admin-photo')
    .setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  expect((await upload).status()).toBe(201);
  await expect(
    page.getByAltText('Попередній перегляд фото товару'),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/admin-product.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Зберегти товар' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: productName }),
  ).toBeVisible();
  await page.goto('http://localhost:5173/');
  await page.getByLabel('Пошук товарів').fill(productName);
  const card = page.locator('.product-card').filter({ hasText: productName });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('321,50');
  await card.getByRole('button', { name: 'Додати', exact: false }).click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Відкрити кошик, товарів: 1' })
    .click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: productName }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Закрити', exact: true }).click();
  await page.goto('http://localhost:5173/admin');
  await expect(
    page.getByRole('heading', { name: `Вітаємо, ${username}.` }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/admin-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Раді бачити вас.' }),
  ).toBeVisible();
  const response = await page.request.get(
    'http://localhost:5173/api/admin/orders',
  );
  expect(response.status()).toBe(401);
  expect(errors).toEqual([]);
});
