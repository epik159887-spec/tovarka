import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { unlink } from 'node:fs/promises';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { orderSchema } from '@tovarka/shared';
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error(
    'Use a migrated TEST_DATABASE_URL ending in _test. Its application tables are erased.',
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { prisma } = await import('../apps/backend/src/config/database.js');
const { app } = await import('../apps/backend/src/app.js');
const { env } = await import('../apps/backend/src/config/env.js');
const { hashPassword } = await import('../apps/backend/src/utils/password.js');
const { setAdminPassword } =
  await import('../apps/backend/src/services/admin.service.js');
const { createOrder } =
  await import('../apps/backend/src/services/order.service.js');
const { uploadDirectory } =
  await import('../apps/backend/src/services/upload.service.js');
const password = 'automated-admin-test-password';
const origin = new URL(env.FRONTEND_URL).origin;
let categoryId: string;
const files: string[] = [];
const productInput = () => ({
  name: 'Новий товар',
  description: 'Новий керамічний товар',
  price: '129.99',
  stock: 8,
  categoryId,
  imageUrl: '/images/cup.svg',
  active: true,
});
const mutation = (
  agent: ReturnType<typeof request.agent>,
  url: string,
  body: unknown,
) =>
  agent.post(url).set('Origin', origin).set('X-Admin-Request', '1').send(body);
async function login() {
  const agent = request.agent(app);
  const result = await mutation(agent, '/api/admin/login', {
    username: 'admin',
    password,
  });
  expect(result.status).toBe(200);
  return agent;
}
beforeEach(async () => {
  await prisma.adminSession.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderRequestKey.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  categoryId = (
    await prisma.category.create({
      data: { name: 'Кераміка', slug: 'ceramics' },
    })
  ).id;
  await prisma.adminUser.create({
    data: { username: 'admin', passwordHash: await hashPassword(password) },
  });
});
afterAll(async () => {
  for (const file of files)
    await unlink(resolve(uploadDirectory, basename(file))).catch(
      () => undefined,
    );
  await prisma.$disconnect();
});
describe('admin authorization', () => {
  it('protects customer data and every write endpoint without authentication', async () => {
    for (const path of [
      '/api/admin/stats',
      '/api/admin/orders',
      '/api/admin/session',
    ]) {
      const result = await request(app).get(path);
      expect(result.status).toBe(401);
      expect(result.headers['cache-control']).toBe('no-store');
    }
    for (const path of [
      '/api/admin/products',
      '/api/admin/categories',
      '/api/admin/uploads',
    ])
      expect((await request(app).post(path).send({})).status).toBe(401);
  });
  it('rejects incorrect credentials without revealing account existence', async () => {
    const agent = request.agent(app);
    const wrong = await mutation(agent, '/api/admin/login', {
      username: 'admin',
      password: 'incorrect',
    });
    const absent = await mutation(agent, '/api/admin/login', {
      username: 'missing',
      password: 'incorrect',
    });
    expect(wrong.status).toBe(401);
    expect(absent.body).toEqual(wrong.body);
  });
  it('uses HttpOnly cookies and stores only token digests', async () => {
    const agent = request.agent(app);
    const result = await mutation(agent, '/api/admin/login', {
      username: 'admin',
      password,
    });
    const cookie = String(result.headers['set-cookie']?.[0]);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    const session = await prisma.adminSession.findFirstOrThrow();
    expect(cookie).not.toContain(session.tokenHash);
    expect((await agent.get('/api/admin/session')).body.data).toEqual({
      username: 'admin',
    });
    const snapshot = JSON.stringify(result.body);
    expect(snapshot).not.toContain('password');
    expect(snapshot).not.toContain('token');
  });
  it('rejects expired sessions and forged cookies', async () => {
    const agent = await login();
    await prisma.adminSession.updateMany({ data: { expiresAt: new Date(0) } });
    expect((await agent.get('/api/admin/orders')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/admin/orders')
          .set('Cookie', `tovarka_admin=${'a'.repeat(43)}`)
      ).status,
    ).toBe(401);
  });
  it('revokes existing sessions when the administrator password is reset', async () => {
    const agent = await login();
    await setAdminPassword('admin', 'a-new-test-password');
    expect(await prisma.adminSession.count()).toBe(0);
    expect((await agent.get('/api/admin/orders')).status).toBe(401);
  });
  it('revokes logout sessions and rejects cross-origin mutations', async () => {
    const agent = await login();
    expect(
      (
        await agent
          .post('/api/admin/products')
          .set('Origin', 'https://attacker.example')
          .set('X-Admin-Request', '1')
          .send(productInput())
      ).status,
    ).toBe(403);
    expect(
      (
        await agent
          .post('/api/admin/products')
          .set('Origin', origin)
          .send(productInput())
      ).status,
    ).toBe(403);
    expect(await prisma.product.count()).toBe(0);
    expect((await mutation(agent, '/api/admin/logout', {})).status).toBe(200);
    expect(await prisma.adminSession.count()).toBe(0);
    expect((await agent.get('/api/admin/stats')).status).toBe(401);
  });
});
describe('admin catalog and order reporting', () => {
  it('creates a real product and exposes it in the storefront API', async () => {
    const agent = await login();
    const result = await mutation(agent, '/api/admin/products', productInput());
    expect(result.status).toBe(201);
    expect(result.body.data.price).toBe('129.99');
    const catalog = await request(app).get('/api/products');
    expect(catalog.body.data.products[0].id).toBe(result.body.data.id);
    expect((await agent.get('/api/admin/stats')).body.data.products).toBe(1);
  });
  it('validates products and hides inactive ones from the public catalog', async () => {
    const agent = await login();
    expect(
      (
        await mutation(agent, '/api/admin/products', {
          ...productInput(),
          price: '-1',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await mutation(agent, '/api/admin/products', {
          ...productInput(),
          categoryId: randomUUID(),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await mutation(agent, '/api/admin/products', {
          ...productInput(),
          active: false,
        })
      ).status,
    ).toBe(201);
    expect((await request(app).get('/api/products')).body.data.total).toBe(0);
  });
  it('creates categories and reports paginated orders, snapshots and counts', async () => {
    const agent = await login();
    const category = await mutation(agent, '/api/admin/categories', {
      name: 'Текстиль',
    });
    expect(category.status).toBe(201);
    const product = await mutation(
      agent,
      '/api/admin/products',
      productInput(),
    );
    const input = orderSchema.parse({
      customer: {
        customerName: 'Тестова Покупчиня',
        phone: '+380671234567',
        deliveryMethod: 'pickup',
        comment: 'Прошу зателефонувати',
      },
      items: [{ productId: product.body.data.id, quantity: 2 }],
    });
    const saved = await createOrder(input, randomUUID());
    const stats = (await agent.get('/api/admin/stats')).body.data;
    expect(stats).toMatchObject({
      orders: 1,
      recentOrders: 1,
      orderTotal: '259.98',
    });
    const orders = await agent.get(
      '/api/admin/orders?search=Покупчиня&limit=1',
    );
    expect(orders.body.data.total).toBe(1);
    const order = orders.body.data.orders[0];
    expect(order.orderNumber).toBe(saved.order.orderNumber);
    expect(order.phone).toBe('+380671234567');
    expect(order.items[0].productName).toBe('Новий товар');
    expect(order.items[0].quantity).toBe(2);
    expect(JSON.stringify(order)).not.toContain('idempotencyKey');
    expect(JSON.stringify(order)).not.toContain('requestHash');
    expect((await agent.get('/api/admin/orders?page=0')).status).toBe(400);
  });
  it('accepts authenticated images, serves them and rejects unsafe formats and large uploads', async () => {
    const agent = await login();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    );
    const result = await agent
      .post('/api/admin/uploads')
      .set('Origin', origin)
      .set('X-Admin-Request', '1')
      .attach('image', png, 'photo.png');
    expect(result.status).toBe(201);
    files.push(result.body.data.imageUrl);
    expect(
      (await request(app).get(result.body.data.imageUrl)).headers[
        'content-type'
      ],
    ).toContain('image/png');
    const invalid = await agent
      .post('/api/admin/uploads')
      .set('Origin', origin)
      .set('X-Admin-Request', '1')
      .attach('image', Buffer.from('<svg onload="alert(1)"/>'), 'fake.png');
    expect(invalid.status).toBe(400);
    const large = await agent
      .post('/api/admin/uploads')
      .set('Origin', origin)
      .set('X-Admin-Request', '1')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png');
    expect(large.status).toBe(413);
  });
});

describe('manual order deletion', () => {
  async function fixture() {
    const product = await prisma.product.create({
      data: { ...productInput(), slug: randomUUID() },
    });
    const input = orderSchema.parse({
      customer: {
        customerName: 'Тест видалення',
        phone: '+380671234567',
        deliveryMethod: 'pickup',
      },
      items: [{ productId: product.id, quantity: 2 }],
    });
    const key = randomUUID();
    const result = await createOrder(input, key);
    const order = await prisma.order.findUniqueOrThrow({
      where: { orderNumber: result.order.orderNumber },
    });
    return { product, input, key, order };
  }
  const remove = (agent: ReturnType<typeof request.agent>, id: string) =>
    agent
      .delete(`/api/admin/orders/${id}`)
      .set('Origin', origin)
      .set('X-Admin-Request', '1');
  it('requires authentication, same-origin protection and a valid order ID', async () => {
    const { order } = await fixture();
    expect(
      (await request(app).delete(`/api/admin/orders/${order.id}`)).status,
    ).toBe(401);
    const agent = await login();
    expect(
      (
        await agent
          .delete(`/api/admin/orders/${order.id}`)
          .set('Origin', origin)
      ).status,
    ).toBe(403);
    expect(
      (
        await agent
          .delete(`/api/admin/orders/${order.id}`)
          .set('Origin', 'https://attacker.example')
          .set('X-Admin-Request', '1')
      ).status,
    ).toBe(403);
    expect((await remove(agent, 'invalid')).status).toBe(400);
    expect((await remove(agent, randomUUID())).status).toBe(404);
    expect(await prisma.order.count()).toBe(1);
  });
  it('removes contacts, items and pending notification, updates totals, and preserves stock and retry safety', async () => {
    const { order, product, input, key } = await fixture();
    const agent = await login();
    expect((await remove(agent, order.id)).status).toBe(200);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(6);
    expect((await agent.get('/api/admin/stats')).body.data).toMatchObject({
      orders: 0,
      recentOrders: 0,
      orderTotal: '0.00',
    });
    expect((await agent.get('/api/admin/orders')).body.data.total).toBe(0);
    expect((await remove(agent, order.id)).status).toBe(404);
    await expect(createOrder(input, key)).rejects.toMatchObject({
      code: 'ORDER_DELETED',
    });
    const { orderRepository } =
      await import('../apps/backend/src/repositories/order.repository.js');
    await expect(
      orderRepository.create(input, key, 'test'),
    ).rejects.toMatchObject({ code: 'ORDER_DELETED' });
    expect(await prisma.order.count()).toBe(0);
    const { notificationRepository } =
      await import('../apps/backend/src/repositories/notification.repository.js');
    expect(await notificationRepository.claim()).toBeNull();
  });
  it('waits for an active notification and allows deleting a delivered order', async () => {
    const { order } = await fixture();
    const agent = await login();
    await prisma.notification.update({
      where: { orderId: order.id },
      data: { status: 'PROCESSING', lockedAt: new Date() },
    });
    expect((await remove(agent, order.id)).status).toBe(409);
    expect(
      await prisma.orderRequestKey.count({
        where: { deletedAt: { not: null } },
      }),
    ).toBe(0);
    expect(await prisma.order.count()).toBe(1);
    await prisma.notification.update({
      where: { orderId: order.id },
      data: { status: 'SENT' },
    });
    expect((await remove(agent, order.id)).status).toBe(200);
  });
  it('cannot recreate an order when checkout replay races with deletion', async () => {
    const { order, product, input, key } = await fixture();
    const agent = await login();
    const [removed] = await Promise.allSettled([
      remove(agent, order.id),
      createOrder(input, key),
    ]);
    expect(removed.status).toBe('fulfilled');
    if (removed.status === 'fulfilled') expect(removed.value.status).toBe(200);
    expect(await prisma.order.count()).toBe(0);
    await expect(createOrder(input, key)).rejects.toMatchObject({
      code: 'ORDER_DELETED',
    });
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(6);
  });
  it('handles simultaneous deletion attempts without restoring stock', async () => {
    const { order, product } = await fixture();
    const agent = await login();
    const responses = await Promise.all([
      remove(agent, order.id),
      remove(agent, order.id),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(await prisma.orderRequestKey.count()).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(6);
  });
});

describe('catalog gallery and deletion', () => {
  const remove = (
    agent: ReturnType<typeof request.agent>,
    kind: string,
    id: string,
  ) =>
    agent
      .delete(`/api/admin/${kind}/${id}`)
      .set('Origin', origin)
      .set('X-Admin-Request', '1');
  it('protects catalog management reads and deletions with session and origin checks', async () => {
    for (const kind of ['products', 'categories']) {
      expect((await request(app).get(`/api/admin/${kind}`)).status).toBe(401);
      expect(
        (await request(app).delete(`/api/admin/${kind}/${randomUUID()}`))
          .status,
      ).toBe(401);
      const agent = await login();
      expect(
        (
          await agent
            .delete(`/api/admin/${kind}/${randomUUID()}`)
            .set('Origin', origin)
        ).status,
      ).toBe(403);
      expect(
        (
          await agent
            .delete(`/api/admin/${kind}/${randomUUID()}`)
            .set('Origin', 'https://attacker.example')
            .set('X-Admin-Request', '1')
        ).status,
      ).toBe(403);
      expect((await remove(agent, kind, 'invalid')).status).toBe(400);
      expect((await remove(agent, kind, randomUUID())).status).toBe(404);
    }
  });
  it('persists ordered galleries in public list, details and the authenticated catalog', async () => {
    const agent = await login();
    const gallery = ['/images/vase.svg', '/images/cup.svg', '/images/tray.svg'];
    const created = await mutation(agent, '/api/admin/products', {
      ...productInput(),
      imageUrl: gallery[0],
      imageUrls: gallery,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(
      (await request(app).get(`/api/products/${id}`)).body.data.imageUrls,
    ).toEqual(gallery);
    expect(
      (await request(app).get('/api/products')).body.data.products[0].imageUrls,
    ).toEqual(gallery);
    expect(
      (await agent.get('/api/admin/products')).body.data.products[0].imageUrls,
    ).toEqual(gallery);
    expect(
      (
        await mutation(agent, '/api/admin/products', {
          ...productInput(),
          imageUrls: ['javascript:bad'],
        })
      ).status,
    ).toBe(400);
    const single = await mutation(agent, '/api/admin/products', productInput());
    expect(single.body.data.imageUrls).toEqual(['/images/cup.svg']);
  });
  it('includes hidden products in management search, pagination and category counts', async () => {
    const agent = await login();
    await mutation(agent, '/api/admin/products', productInput());
    await mutation(agent, '/api/admin/products', {
      ...productInput(),
      name: 'Прихований товар',
      active: false,
    });
    const found = await agent.get(
      '/api/admin/products?search=Прихований&limit=1',
    );
    expect(found.body.data).toMatchObject({ total: 1, pages: 1 });
    expect(found.body.data.products[0].active).toBe(false);
    expect(
      (await agent.get('/api/admin/products?limit=1&page=2')).body.data
        .products,
    ).toHaveLength(1);
    expect((await agent.get('/api/admin/products?page=0')).status).toBe(400);
    expect(
      (await agent.get('/api/admin/categories')).body.data[0].productCount,
    ).toBe(2);
  });
  it('preserves order snapshots and replay after deleting the product and its category', async () => {
    const agent = await login();
    const created = await mutation(
      agent,
      '/api/admin/products',
      productInput(),
    );
    const id = created.body.data.id;
    const input = orderSchema.parse({
      customer: {
        customerName: 'Покупчиня товару',
        phone: '+380671234567',
        deliveryMethod: 'pickup',
      },
      items: [{ productId: id, quantity: 2 }],
    });
    const key = randomUUID();
    const saved = await createOrder(input, key);
    expect((await remove(agent, 'products', id)).status).toBe(200);
    expect((await remove(agent, 'products', id)).status).toBe(404);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(404);
    expect((await request(app).get('/api/products')).body.data.total).toBe(0);
    expect((await agent.get('/api/admin/stats')).body.data).toMatchObject({
      products: 0,
      orders: 1,
      orderTotal: '259.98',
    });
    const item = await prisma.orderItem.findFirstOrThrow();
    expect(item).toMatchObject({
      productId: null,
      productName: 'Новий товар',
      quantity: 2,
    });
    expect(item.unitPrice.toFixed(2)).toBe('129.99');
    const orders = (await agent.get('/api/admin/orders')).body.data.orders;
    expect(orders[0].items[0].productName).toBe('Новий товар');
    expect((await remove(agent, 'categories', categoryId)).status).toBe(200);
    expect((await request(app).get('/api/categories')).body.data).toEqual([]);
    expect((await createOrder(input, key)).order.orderNumber).toBe(
      saved.order.orderNumber,
    );
    await expect(createOrder(input, randomUUID())).rejects.toMatchObject({
      code: 'PRODUCT_UNAVAILABLE',
    });
    expect(await prisma.order.count()).toBe(1);
  });
  it('blocks deleting a nonempty category including hidden products and allows removal once empty', async () => {
    const agent = await login();
    const created = await mutation(agent, '/api/admin/products', {
      ...productInput(),
      active: false,
    });
    const blocked = await remove(agent, 'categories', categoryId);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CATEGORY_NOT_EMPTY');
    expect(await prisma.product.count()).toBe(1);
    expect((await remove(agent, 'products', created.body.data.id)).status).toBe(
      200,
    );
    expect((await remove(agent, 'categories', categoryId)).status).toBe(200);
    expect((await remove(agent, 'categories', categoryId)).status).toBe(404);
    expect(
      (await mutation(agent, '/api/admin/products', productInput())).status,
    ).toBe(400);
  });
});
