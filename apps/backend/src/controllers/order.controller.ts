import type { Request, Response } from 'express';
import { z } from '@tovarka/shared';
import { orderSchema } from '@tovarka/shared';
import { createOrder } from '../services/order.service.js';
export async function orderController(req: Request, res: Response) {
  const key = z
    .string({ required_error: 'Відсутній ключ повторного запиту' })
    .uuid('Некоректний ключ запиту')
    .parse(req.get('Idempotency-Key'));
  const result = await createOrder(orderSchema.parse(req.body), key);
  res.status(result.replayed ? 200 : 201).json({ data: result.order });
}
