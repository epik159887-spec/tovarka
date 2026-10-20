import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { OrderInput } from '@tovarka/shared';
import { orderRepository } from '../repositories/order.repository.js';
import { AppError } from '../utils/errors.js';
const response = (
  order: NonNullable<Awaited<ReturnType<typeof orderRepository.find>>>,
) => ({
  orderNumber: order.orderNumber,
  total: order.total.toFixed(2),
  createdAt: order.createdAt.toISOString(),
  notificationStatus: order.notification?.status ?? 'PENDING',
});
export async function createOrder(input: OrderInput, key: string) {
  const canonical = {
    customer: input.customer,
    items: [...input.items].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    ),
  };
  const hash = createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
  const replay = async () => {
    const existing = await orderRepository.find(key);
    if (!existing) return null;
    if (existing.requestHash !== hash)
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Цей запит уже використано для іншого замовлення. Перевірте кошик.',
      );
    return { order: response(existing), replayed: true };
  };
  const existing = await replay();
  if (existing) return existing;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const order = await orderRepository.create(input, key, hash);
      return { order: response(order), replayed: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const result = await replay();
          if (result) return result;
        }
        if (error.code === 'P2034') {
          if (attempt < 3) {
            await new Promise((resolve) =>
              setTimeout(resolve, 20 * (attempt + 1)),
            );
            continue;
          }
          throw new AppError(
            503,
            'ORDER_BUSY',
            'Сервіс зайнятий. Спробуйте повторити замовлення.',
          );
        }
      }
      // A simultaneous identical request may have consumed the final stock.
      if (error instanceof AppError && error.code === 'INSUFFICIENT_STOCK') {
        const result = await replay();
        if (result) return result;
      }
      throw error;
    }
  }
  throw new AppError(
    503,
    'ORDER_BUSY',
    'Сервіс зайнятий. Спробуйте повторити замовлення.',
  );
}
