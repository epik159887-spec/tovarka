import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { orderSchema } from '@tovarka/shared';
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error(
    'Set TEST_DATABASE_URL to a migrated PostgreSQL database with a name ending in _test. Tests erase its contents.',
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.TELEGRAM_BOT_TOKEN = 'automated-test-token';
process.env.TELEGRAM_CHAT_ID = '-1';
const { prisma } = await import('../apps/backend/src/config/database.js');
const { app } = await import('../apps/backend/src/app.js');
const { createOrder } =
  await import('../apps/backend/src/services/order.service.js');
const { processNotification } =
  await import('../apps/backend/src/services/notification.service.js');
const productId = '10000000-0000-4000-8000-000000000001';
const otherId = '20000000-0000-4000-8000-000000000002';
const customer = {
  customerName: 'Олена <Коваль>',
  phone: '+380671234567',
  deliveryMethod: 'post',
  deliveryAddress: 'Київ, відділення 12',
};
const input = (quantity = 1) =>
  orderSchema.parse({ customer, items: [{ productId, quantity }] });
const post = (payload: unknown, key = randomUUID()) =>
  request(app).post('/api/orders').set('Idempotency-Key', key).send(payload);
beforeEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  const category = await prisma.category.create({
    data: { name: 'Кераміка', slug: 'ceramics' },
  });
  await prisma.product.create({
    data: {
      id: productId,
      name: 'Горнятко',
      slug: 'cup',
      description: 'Для чаю',
      price: '123.45',
      imageUrl: '/images/cup.svg',
      stock: 5,
      categoryId: category.id,
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await prisma.$disconnect();
});
describe('catalog API', () => {
  it('checks database readiness, filtering, sorting and invalid pagination', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
    const result = await request(app).get(
      '/api/products?search=Горн&category=ceramics&sort=price-asc&limit=1',
    );
    expect(result.status).toBe(200);
    expect(result.body.data.products).toHaveLength(1);
    expect(result.body.data.total).toBe(1);
    expect((await request(app).get('/api/products?page=0')).status).toBe(400);
    expect((await request(app).get('/api/products/not-a-uuid')).status).toBe(
      400,
    );
    expect((await request(app).get('/api/categories')).body.data).toHaveLength(
      1,
    );
  });
  it('hides inactive products', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    expect((await request(app).get('/api/products')).body.data.total).toBe(0);
    expect((await request(app).get(`/api/products/${productId}`)).status).toBe(
      404,
    );
  });
});
describe('transactional orders', () => {
  it('persists snapshots and recalculates total from current database price', async () => {
    const result = await post(input(2));
    expect(result.status).toBe(201);
    expect(result.body.data.total).toBe('246.90');
    expect(result.body.data.notificationStatus).toBe('PENDING');
    const order = await prisma.order.findFirstOrThrow({
      include: { items: true, notification: true },
    });
    expect(order.items[0]?.productName).toBe('Горнятко');
    expect(order.items[0]?.unitPrice.toFixed(2)).toBe('123.45');
    expect(order.notification?.status).toBe('PENDING');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(3);
  });
  it('rejects client-supplied prices, invalid products and quantities', async () => {
    expect(
      (
        await post({
          ...input(),
          items: [{ productId, quantity: 1, price: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (await post({ ...input(), items: [{ productId, quantity: 0 }] })).status,
    ).toBe(400);
    expect(
      (
        await post({
          ...input(),
          items: [{ productId: randomUUID(), quantity: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });
  it('replays identical requests and rejects key reuse with changed data', async () => {
    const key = randomUUID();
    const first = await post(input(), key);
    const second = await post(input(), key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber);
    expect((await post(input(2), key)).status).toBe(409);
    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });
  it('handles concurrent identical requests exactly once', async () => {
    const key = randomUUID();
    const results = await Promise.all([
      createOrder(input(), key),
      createOrder(input(), key),
    ]);
    expect(results[0]?.order.orderNumber).toBe(results[1]?.order.orderNumber);
    expect(await prisma.order.count()).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(4);
  });
  it('rolls back earlier stock updates when another line is unavailable', async () => {
    const first = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    await prisma.product.create({
      data: {
        id: otherId,
        name: 'Ваза',
        slug: 'vase',
        description: 'Ваза',
        price: 200,
        imageUrl: '/images/vase.svg',
        stock: 0,
        categoryId: first.categoryId,
      },
    });
    const payload = orderSchema.parse({
      customer,
      items: [
        { productId, quantity: 1 },
        { productId: otherId, quantity: 1 },
      ],
    });
    await expect(createOrder(payload, randomUUID())).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    });
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(5);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
  });
  it('prevents overselling during concurrent orders', async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { stock: 1 },
    });
    const results = await Promise.allSettled([
      createOrder(input(), randomUUID()),
      createOrder(input(), randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(0);
  });
  it('keeps a committed order after Telegram failure and does not resend on order replay', async () => {
    const key = randomUUID();
    const first = await createOrder(input(), key);
    const transport = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.stubGlobal('fetch', transport);
    await processNotification();
    await createOrder(input(), key);
    await processNotification();
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.notification.findFirstOrThrow()).status).toBe(
      'UNKNOWN',
    );
    expect(transport).toHaveBeenCalledTimes(1);
    expect((await prisma.order.findFirstOrThrow()).orderNumber).toBe(
      first.order.orderNumber,
    );
  });
  it('delivers a queued notification once and escapes customer content', async () => {
    await createOrder(input(), randomUUID());
    const transport = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', transport);
    await processNotification();
    await processNotification();
    expect(transport).toHaveBeenCalledTimes(1);
    expect((await prisma.notification.findFirstOrThrow()).status).toBe('SENT');
    const body = String(transport.mock.calls[0]?.[1]?.body);
    expect(body).toContain('&lt;Коваль&gt;');
    expect(body).not.toContain('<Коваль>');
  });
  it('persists multipart notification progress without repeating delivered parts', async () => {
    const long = input();
    long.customer.comment = '<'.repeat(1000);
    await prisma.product.update({
      where: { id: productId },
      data: { name: 'Річ'.repeat(1000) },
    });
    await createOrder(long, randomUUID());
    const transport = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{"ok":true}')));
    vi.stubGlobal('fetch', transport);
    await processNotification();
    const partial = await prisma.notification.findFirstOrThrow();
    expect(partial.status).toBe('PENDING');
    expect(partial.nextPart).toBe(1);
    await processNotification();
    await processNotification();
    expect((await prisma.notification.findFirstOrThrow()).status).toBe('SENT');
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]?.[1]?.body).not.toEqual(
      transport.mock.calls[1]?.[1]?.body,
    );
  });
  it('throttles abusive order submissions with a Ukrainian error', async () => {
    let response;
    for (let i = 0; i < 13; i++)
      response = await request(app).post('/api/orders').send({});
    expect(response?.status).toBe(429);
    expect(response?.body.error.code).toBe('RATE_LIMIT');
  });
});
