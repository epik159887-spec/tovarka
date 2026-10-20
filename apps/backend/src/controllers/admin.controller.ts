import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  z,
  adminLoginSchema,
  adminOrderQuerySchema,
  createProductSchema,
  createCategorySchema,
} from '@tovarka/shared';
import {
  loginAdmin,
  createAdminProduct,
  deleteAdminOrder,
  deleteAdminCatalogItem,
} from '../services/admin.service.js';
import { adminRepository } from '../repositories/admin.repository.js';
import {
  adminCookieName,
  adminCookieOptions,
  readAdminToken,
} from '../middleware/admin-auth.js';
import { hashSessionToken } from '../utils/password.js';
import { saveProductImage } from '../services/upload.service.js';
export const adminController = {
  async login(req: Request, res: Response) {
    const result = await loginAdmin(adminLoginSchema.parse(req.body));
    const previous = readAdminToken(req);
    if (previous)
      await adminRepository.revokeSession(hashSessionToken(previous));
    res
      .cookie(adminCookieName, result.token, adminCookieOptions)
      .json({ data: { username: result.username } });
  },
  async logout(req: Request, res: Response) {
    const token = readAdminToken(req);
    if (token) await adminRepository.revokeSession(hashSessionToken(token));
    const options = { ...adminCookieOptions };
    delete options.maxAge;
    res.clearCookie(adminCookieName, options).json({ data: null });
  },
  session(_req: Request, res: Response) {
    res.json({ data: res.locals.admin });
  },
  async stats(_req: Request, res: Response) {
    res.json({ data: await adminRepository.stats() });
  },
  async orders(req: Request, res: Response) {
    res.json({
      data: await adminRepository.orders(
        adminOrderQuerySchema.parse(req.query),
      ),
    });
  },
  async deleteOrder(req: Request, res: Response) {
    res.json({
      data: await deleteAdminOrder(z.string().uuid().parse(req.params.id)),
    });
  },
  async products(req: Request, res: Response) {
    res.json({
      data: await adminRepository.products(
        adminOrderQuerySchema.parse(req.query),
      ),
    });
  },
  async categories(_req: Request, res: Response) {
    res.json({ data: await adminRepository.categories() });
  },
  async deleteProduct(req: Request, res: Response) {
    res.json({
      data: await deleteAdminCatalogItem(
        'product',
        z.string().uuid().parse(req.params.id),
      ),
    });
  },
  async deleteCategory(req: Request, res: Response) {
    res.json({
      data: await deleteAdminCatalogItem(
        'category',
        z.string().uuid().parse(req.params.id),
      ),
    });
  },
  async createProduct(req: Request, res: Response) {
    res.status(201).json({
      data: await createAdminProduct(createProductSchema.parse(req.body)),
    });
  },
  async createCategory(req: Request, res: Response) {
    const input = createCategorySchema.parse(req.body);
    res.status(201).json({
      data: await adminRepository.createCategory(
        input.name,
        `category-${randomUUID()}`,
      ),
    });
  },
  async upload(req: Request, res: Response) {
    res.status(201).json({ data: await saveProductImage(req.file) });
  },
};
