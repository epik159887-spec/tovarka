import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { catalogController } from '../controllers/catalog.controller.js';
import { orderController } from '../controllers/order.controller.js';
import { prisma } from '../config/database.js';
export const api = Router();
api.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ data: { status: 'ok' } });
  } catch {
    res.status(503).json({
      error: { code: 'NOT_READY', message: 'Сервіс тимчасово недоступний' },
    });
  }
});
api.get('/products', catalogController.products);
api.get('/products/:id', catalogController.product);
api.get('/categories', catalogController.categories);
api.post(
  '/orders',
  rateLimit({
    windowMs: 60000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT',
        message: 'Забагато запитів. Спробуйте за хвилину.',
      },
    },
  }),
  orderController,
);
