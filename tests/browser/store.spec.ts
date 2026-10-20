import { test, expect } from '@playwright/test';
test('catalog filters, stock limits, persistent cart and successful checkout', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Дім починається з теплих дрібниць.' }),
  ).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(6);
  await expect(
    page
      .locator('.product-card')
      .filter({ hasText: 'Плед' })
      .getByRole('button'),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Кераміка', exact: false }).click();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByLabel('Пошук товарів').fill('Горнятко');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Додати Горнятко «Теплий ранок» до кошика' })
    .click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Відкрити кошик, товарів: 1' })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Зменшити кількість' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Збільшити кількість' }).click();
  await expect(page.locator('.cart-summary strong')).toHaveText(/960/);
  await page.getByRole('button', { name: 'Оформити замовлення' }).click();
  await page.getByRole('button', { name: 'Підтвердити замовлення' }).click();
  await expect(
    page.getByText('Вкажіть ім’я та прізвище (щонайменше 2 символи)', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Ім’я та прізвище').fill('Тестова Покупчиня');
  await page.getByLabel('Номер телефону').fill('0671234567');
  await page
    .getByLabel('Місто й відділення Нової пошти')
    .fill('Київ, тестове відділення 1');
  await page.getByRole('button', { name: 'Підтвердити замовлення' }).click();
  await expect(
    page.getByRole('heading', { name: 'Дякуємо за замовлення!' }),
  ).toBeVisible();
  await expect(page.locator('.success-number strong')).toHaveText(
    /^TV-[A-F0-9]{32}$/,
  );
  await page.getByRole('button', { name: 'Повернутися до колекції' }).click();
  await expect(
    page.getByRole('button', { name: 'Відкрити кошик, товарів: 0' }),
  ).toBeVisible();
});
test('mobile navigation, empty state, keyboard dialog and responsive layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Відкрити меню' }).click();
  await page
    .locator('header nav')
    .getByRole('link', { name: 'Колекція' })
    .click();
  await page.getByLabel('Пошук товарів').fill('НемаєТакогоТовару');
  await expect(
    page.getByRole('heading', { name: 'Поки нічого не знайшли' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Показати всі товари' }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page
    .getByRole('button', { name: 'Відкрити кошик, товарів: 0' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Тут ще трохи порожньо' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({
    path: 'test-results/store-mobile.png',
    fullPage: true,
  });
});
test('desktop visual and local images', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(6);
  expect(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/store-desktop.png',
    fullPage: true,
  });
});
