import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdmin, requireAdminOrigin } from '../middleware/admin-auth.js';
import { imageUpload } from '../services/upload.service.js';
export const adminApi = Router();
adminApi.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
adminApi.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'ADMIN_RATE_LIMIT',
        message: 'Забагато спроб входу. Спробуйте через 15 хвилин.',
      },
    },
  }),
  requireAdminOrigin,
  adminController.login,
);
adminApi.use(requireAdmin);
adminApi.get('/session', adminController.session);
adminApi.get('/stats', adminController.stats);
adminApi.get('/orders', adminController.orders);
adminApi.get('/products', adminController.products);
adminApi.get('/categories', adminController.categories);
adminApi.use(requireAdminOrigin);
adminApi.delete('/products/:id', adminController.deleteProduct);
adminApi.delete('/categories/:id', adminController.deleteCategory);
adminApi.delete('/orders/:id', adminController.deleteOrder);
adminApi.post('/logout', adminController.logout);
adminApi.post('/products', adminController.createProduct);
adminApi.post('/categories', adminController.createCategory);
adminApi.post(
  '/uploads',
  rateLimit({
    windowMs: 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'UPLOAD_RATE_LIMIT',
        message: 'Забагато фото. Спробуйте за хвилину.',
      },
    },
  }),
  imageUpload,
  adminController.upload,
);
