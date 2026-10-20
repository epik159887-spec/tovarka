import { test, expect } from '@playwright/test';

test('HTTP checkout retries a committed order without secure-context crypto APIs', async ({
  page,
  baseURL,
}) => {
  const backendOrigin = new URL(baseURL ?? 'http://127.0.0.1:5173');
  const origin = new URL(backendOrigin);
  origin.hostname = 'tovarka.test';
  origin.protocol = 'http:';
  const localURL = (url: string) => {
    const parsed = new URL(url);
    return new URL(parsed.pathname + parsed.search, backendOrigin).href;
  };
  // Serve a real HTTP origin over loopback without depending on LAN routing or DNS.
  await page.route(/^http:\/\/tovarka\.test(?::\d+)?\//, async (route) => {
    await route.fulfill({
      response: await route.fetch({ url: localURL(route.request().url()) }),
    });
  });
  await page.goto(origin.origin);
  expect(
    await page.evaluate(() => ({
      secure: isSecureContext,
      subtle: typeof crypto.subtle,
      randomUUID: typeof crypto.randomUUID,
      getRandomValues: typeof crypto.getRandomValues,
    })),
  ).toEqual({
    secure: false,
    subtle: 'undefined',
    randomUUID: 'undefined',
    getRandomValues: 'function',
  });
  await page.getByLabel('Пошук товарів').fill('Горнятко');
  await page
    .getByRole('button', { name: 'Додати Горнятко «Теплий ранок» до кошика' })
    .click();
  await page
    .getByRole('button', { name: 'Відкрити кошик, товарів: 1' })
    .click();
  await page.getByRole('button', { name: 'Оформити замовлення' }).click();
  await page.getByLabel('Ім’я та прізвище').fill('Перевірка HTTP-замовлення');
  await page.getByLabel('Номер телефону').fill('0671234567');
  await page
    .getByLabel('Місто й відділення Нової пошти')
    .fill('Київ, тестове відділення 1');
  const keys: string[] = [];
  let savedNumber = '';
  await page.route('**/api/orders', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (keys.length === 1) {
      // Save the actual order, then simulate losing the response to the browser.
      const response = await route.fetch({
        url: localURL(route.request().url()),
      });
      expect(response.status()).toBe(201);
      savedNumber = (await response.json()).data.orderNumber;
      await route.abort('failed');
    } else {
      await route.fallback();
    }
  });
  await page.getByRole('button', { name: 'Підтвердити замовлення' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Не вдалося зв’язатися з магазином',
  );
  expect(keys[0]).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Відкрити кошик, товарів: 1' })
    .click();
  await page.getByRole('button', { name: 'Оформити замовлення' }).click();
  await page.getByLabel('Ім’я та прізвище').fill('Перевірка HTTP-замовлення');
  await page.getByLabel('Номер телефону').fill('0671234567');
  await page
    .getByLabel('Місто й відділення Нової пошти')
    .fill('Київ, тестове відділення 1');
  const replay = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/orders') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Підтвердити замовлення' }).click();
  expect((await replay).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Дякуємо за замовлення!' }),
  ).toBeVisible();
  await expect(page.locator('.success-number strong')).toHaveText(savedNumber);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});
