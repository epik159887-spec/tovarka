import { z } from 'zod';

export const normalizePhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 && digits.startsWith('0')
    ? `+38${digits}`
    : `+${digits}`;
};
export const customerSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(2, 'Вкажіть ім’я та прізвище (щонайменше 2 символи)')
      .max(100, 'Не більше 100 символів'),
    phone: z
      .string()
      .transform(normalizePhoneNumber)
      .pipe(
        z
          .string()
          .regex(
            /^\+380\d{9}$/,
            'Вкажіть український номер телефону: +380XXXXXXXXX',
          ),
      ),
    email: z
      .union([
        z.literal(''),
        z
          .string()
          .trim()
          .email('Перевірте електронну адресу')
          .max(254, 'Адреса надто довга'),
      ])
      .optional(),
    deliveryMethod: z.enum(['post', 'courier', 'pickup'], {
      errorMap: () => ({ message: 'Оберіть спосіб доставки' }),
    }),
    deliveryAddress: z
      .string()
      .trim()
      .max(300, 'Не більше 300 символів')
      .optional(),
    comment: z.string().trim().max(1000, 'Не більше 1000 символів').optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.deliveryMethod !== 'pickup' &&
      (!value.deliveryAddress || value.deliveryAddress.length < 5)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['deliveryAddress'],
        message:
          'Вкажіть місто й відділення або адресу (щонайменше 5 символів)',
      });
    }
  });
export const orderSchema = z
  .object({
    customer: customerSchema,
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid('Некоректний товар'),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1, 'Кошик порожній')
      .max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.items.map((i) => i.productId)).size !== value.items.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Товар у замовленні повторюється',
      });
  });
export const productQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(''),
    category: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80)
      .optional(),
    sort: z
      .enum(['newest', 'price-asc', 'price-desc', 'name'])
      .default('newest'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict();
export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerForm = z.input<typeof customerSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  imageUrl: string;
  stock: number;
  category: Category;
}
export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pages: number;
}
export interface OrderResult {
  orderNumber: string;
  total: string;
  notificationStatus: string;
  createdAt: string;
}
export interface CartEntry {
  product: Product;
  quantity: number;
}
export const deliveryLabels = {
  post: 'Нова пошта',
  courier: 'Кур’єрська доставка',
  pickup: 'Самовивіз за домовленістю',
} as const;
export const toMinorUnits = (price: string): number =>
  Math.round(Number(price) * 100);
export const calculateCartTotal = (items: CartEntry[]): number =>
  items.reduce(
    (total, item) => total + toMinorUnits(item.product.price) * item.quantity,
    0,
  );

export { z, ZodError } from 'zod';
