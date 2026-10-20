import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const username = process.env.ADMIN_TEST_USERNAME;
const password = process.env.ADMIN_TEST_PASSWORD;
test('multiple uploads, cover selection, gallery and confirmed catalog deletion preserve order history', async ({
  page,
}) => {
  test.skip(
    !username || !password || process.env.ADMIN_CATALOG_TEST_ENABLED !== '1',
    'Requires an explicitly enabled disposable catalog and test administrator.',
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const suffix = randomUUID().slice(0, 8);
  const name = `Тестовий товар із галереєю ${suffix}`;
  const category = `Тестова галерея ${suffix}`;
  const customer = `Історія галереї ${suffix}`;
  await page.goto('/admin');
  await page.getByLabel('Логін', { exact: true }).fill(username!);
  await page.getByLabel('Пароль', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Увійти до панелі' }).click();
  await page.getByRole('button', { name: 'Додати товар', exact: true }).click();
  await page.getByLabel('Назва товару', { exact: true }).fill(name);
  await page
    .getByLabel('Опис товару', { exact: true })
    .fill('Товар для перевірки галереї та збереження історії.');
  await page.getByLabel('Ціна, грн', { exact: true }).fill('321,50');
  await page.getByLabel('Кількість на складі', { exact: true }).fill('7');
  await page
    .locator('summary')
    .filter({ hasText: 'Створити нову категорію' })
    .click();
  await page.getByLabel('Назва нової категорії').fill(category);
  await page
    .getByRole('button', { name: 'Додати категорію', exact: true })
    .click();
  await expect(
    page.getByLabel('Категорія', { exact: true }).locator('option:checked'),
  ).toHaveText(category);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );
  await page.locator('#admin-photo').setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: png },
    { name: 'second.png', mimeType: 'image/png', buffer: png },
  ]);
  await expect(
    page.getByText('Додано 2 / 10.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Зберегти товар', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Зробити фото 2 головним' }).click();
  await page.getByRole('button', { name: 'Прибрати фото 2' }).click();
  await page.getByLabel('Або посилання на зображення').fill('/images/cup.svg');
  await page.getByRole('button', { name: 'Додати фото за посиланням' }).click();
  await expect(page.locator('.admin-photo-item')).toHaveCount(2);
  await page.screenshot({
    path: 'test-results/admin-multiple-photos.png',
    fullPage: true,
  });
  const creation = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/admin/products') &&
      r.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Зберегти товар', exact: true })
    .click();
  const saved = (await (await creation).json()).data;
  expect(saved.imageUrls).toHaveLength(2);
  expect(saved.imageUrls[0]).toBe(saved.imageUrl);
  await expect(
    page.getByRole('status').filter({ hasText: name }),
  ).toBeVisible();
  await page.goto('/');
  await page.getByLabel('Пошук товарів', { exact: true }).fill(name);
  const card = page.locator('.product-card').filter({ hasText: name });
  await expect(card).toHaveCount(1);
  await card
    .getByRole('button', { name: `Переглянути фото ${name}`, exact: true })
    .click();
  const gallery = page.getByRole('dialog', { name, exact: true });
  await expect(
    gallery.getByRole('img', { name: `${name} — фото 1` }),
  ).toHaveAttribute('src', saved.imageUrls[0]);
  await gallery.getByRole('button', { name: 'Наступне фото' }).click();
  await expect(
    gallery.getByRole('img', { name: `${name} — фото 2` }),
  ).toHaveAttribute('src', saved.imageUrls[1]);
  await page.keyboard.press('ArrowLeft');
  await expect(gallery).toContainText('Фото 1 із 2');
  await gallery.getByRole('button', { name: 'Переглянути фото 2' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/product-gallery-mobile.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await expect(gallery).not.toBeVisible();
  const input = {
    customer: {
      customerName: customer,
      phone: '+380671234567',
      deliveryMethod: 'pickup',
    },
    items: [{ productId: saved.id, quantity: 1 }],
  };
  const key = randomUUID();
  expect(
    (
      await page.request.post('/api/orders', {
        data: input,
        headers: { 'Idempotency-Key': key },
      })
    ).status(),
  ).toBe(201);
  await page.goto('/admin');
  await page
    .getByRole('button', { name: 'Товари й категорії', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: `Видалити категорію ${category}`,
      exact: true,
    })
    .click();
  const categoryDialog = page.getByRole('dialog', {
    name: 'Видалити категорію?',
  });
  await expect(categoryDialog).toContainText('Спочатку видаліть');
  await expect(
    categoryDialog.getByRole('button', { name: 'Так, видалити' }),
  ).toBeDisabled();
  await categoryDialog.getByRole('button', { name: 'Скасувати' }).click();
  const remove = page.getByRole('button', {
    name: `Видалити товар ${name}`,
    exact: true,
  });
  await remove.click();
  const productDialog = page.getByRole('dialog', { name: 'Видалити товар?' });
  await productDialog.getByRole('button', { name: 'Скасувати' }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await productDialog.getByRole('button', { name: 'Так, видалити' }).click();
  await expect(remove).toHaveCount(0);
  expect((await page.request.get(`/api/products/${saved.id}`)).status()).toBe(
    404,
  );
  await page
    .getByRole('button', {
      name: `Видалити категорію ${category}`,
      exact: true,
    })
    .click();
  await categoryDialog.getByRole('button', { name: 'Так, видалити' }).click();
  await expect(
    page.getByRole('button', {
      name: `Видалити категорію ${category}`,
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post('/api/orders', {
        data: input,
        headers: { 'Idempotency-Key': key },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole('button', { name: 'Замовлення', exact: true }).click();
  await page.getByRole('textbox', { name: 'Пошук замовлень' }).fill(customer);
  const row = page.getByRole('row').filter({ hasText: customer });
  await expect(row).toBeVisible();
  await row
    .getByRole('button', { name: 'Переглянути замовлення', exact: false })
    .click();
  await expect(page.getByRole('dialog')).toContainText(name);
  await expect(page.getByRole('dialog')).toContainText('321,50');
  expect(errors).toEqual([]);
});
