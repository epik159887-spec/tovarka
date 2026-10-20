import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';
import type { OrderInput } from '@tovarka/shared';
import { AppError } from '../utils/errors.js';
const include = { notification: true } as const;
export const orderRepository = {
  async find(key: string) {
    const order = await prisma.order.findUnique({
      where: { idempotencyKey: key },
      include,
    });
    if (!order) await this.assertNotDeleted(key);
    return order;
  },
  async assertNotDeleted(
    key: string,
    client: Pick<typeof prisma, 'orderRequestKey'> = prisma,
  ) {
    if (
      await client.orderRequestKey.findUnique({
        where: { idempotencyKey: key, deletedAt: { not: null } },
      })
    )
      throw new AppError(
        409,
        'ORDER_DELETED',
        'Це замовлення видалено адміністратором. Для нового замовлення оновіть кошик.',
      );
  },
  async create(input: OrderInput, key: string, requestHash: string) {
    return prisma.$transaction(
      async (tx) => {
        await this.assertNotDeleted(key, tx);
        // The permanent unique reservation also blocks retries racing with deletion.
        await tx.orderRequestKey.create({ data: { idempotencyKey: key } });
        const products = await tx.product.findMany({
          where: {
            id: { in: input.items.map((i) => i.productId) },
            active: true,
          },
        });
        const lines = input.items.map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product)
            throw new AppError(
              400,
              'PRODUCT_UNAVAILABLE',
              'Один із товарів більше не доступний. Оновіть кошик.',
            );
          return {
            productId: product.id,
            productName: product.name,
            unitPrice: product.price,
            quantity: item.quantity,
            lineTotal: product.price.mul(item.quantity),
          };
        });
        // Acquire row locks in a stable order. Conditional updates prevent overselling.
        for (const line of [...lines].sort((a, b) =>
          a.productId.localeCompare(b.productId),
        )) {
          const updated = await tx.product.updateMany({
            where: {
              id: line.productId,
              active: true,
              stock: { gte: line.quantity },
            },
            data: { stock: { decrement: line.quantity } },
          });
          if (updated.count !== 1)
            throw new AppError(
              409,
              'INSUFFICIENT_STOCK',
              'Недостатньо товару на складі. Оновіть кошик.',
            );
        }
        return tx.order.create({
          data: {
            ...input.customer,
            email: input.customer.email || null,
            deliveryAddress:
              input.customer.deliveryMethod === 'pickup'
                ? null
                : input.customer.deliveryAddress,
            orderNumber: `TV-${randomUUID().replaceAll('-', '').toUpperCase()}`,
            total: lines.reduce(
              (sum, line) => sum.add(line.lineTotal),
              new Prisma.Decimal(0),
            ),
            idempotencyKey: key,
            requestHash,
            items: { create: lines },
            notification: { create: {} },
          },
          include,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      },
    );
  },
};
