import { z } from 'zod';
import type { Product } from './index.js';
export const productImageSchema = z
  .string()
  .trim()
  .min(1, 'Додайте фото товару')
  .max(2000, 'Посилання надто довге')
  .refine((value) => {
    if (
      /^\/(images|uploads)\/[a-zA-Z0-9_-]+\.(svg|png|jpg|jpeg|webp)$/.test(
        value,
      )
    )
      return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Додайте HTTPS-посилання на зображення або завантажте фото');
export const adminLoginSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, 'Вкажіть логін')
      .max(80, 'Логін надто довгий'),
    password: z
      .string()
      .min(1, 'Вкажіть пароль')
      .max(128, 'Пароль надто довгий'),
  })
  .strict();
export const createProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Назва має містити щонайменше 2 символи')
      .max(120, 'Назва надто довга'),
    description: z
      .string()
      .trim()
      .min(5, 'Додайте опис: щонайменше 5 символів')
      .max(2000, 'Опис надто довгий'),
    price: z
      .string()
      .trim()
      .regex(
        /^\d{1,10}(\.\d{1,2})?$/,
        'Вкажіть ціну числом, до двох знаків після крапки',
      )
      .refine((value) => Number(value) > 0, 'Ціна має бути більшою за нуль'),
    stock: z
      .number({ invalid_type_error: 'Вкажіть кількість числом' })
      .int('Кількість має бути цілим числом')
      .min(0, 'Кількість не може бути від’ємною')
      .max(1000000, 'Кількість надто велика'),
    categoryId: z.string().uuid('Оберіть категорію'),
    imageUrl: productImageSchema,
    active: z.boolean().default(true),
  })
  .strict();
export const createCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Вкажіть назву категорії')
      .max(80, 'Назва надто довга'),
  })
  .strict();
export const adminOrderQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(''),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();
export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateProductForm = z.input<typeof createProductSchema>;
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export interface AdminIdentity {
  username: string;
}
export interface AdminStats {
  orders: number;
  recentOrders: number;
  products: number;
  orderTotal: string;
}
export interface AdminProduct extends Product {
  active: boolean;
  createdAt: string;
}
export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  email: string | null;
  deliveryMethod: string;
  deliveryAddress: string | null;
  comment: string | null;
  status: string;
  total: string;
  createdAt: string;
  notification: { status: string } | null;
  items: {
    id: string;
    productName: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
  }[];
}
export interface AdminOrderPage {
  orders: AdminOrder[];
  total: number;
  page: number;
  pages: number;
}
