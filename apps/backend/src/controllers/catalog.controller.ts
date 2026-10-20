import type { Request, Response } from 'express';
import { z } from '@tovarka/shared';
import { productQuerySchema } from '@tovarka/shared';
import { productService } from '../services/product.service.js';
export const catalogController = {
  async products(req: Request, res: Response) {
    res.json({
      data: await productService.list(productQuerySchema.parse(req.query)),
    });
  },
  async product(req: Request, res: Response) {
    res.json({
      data: await productService.find(
        z
          .string()
          .uuid('Некоректний ідентифікатор товару')
          .parse(req.params.id),
      ),
    });
  },
  async categories(_req: Request, res: Response) {
    res.json({ data: await productService.categories() });
  },
};
