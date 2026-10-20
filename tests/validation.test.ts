import { describe, expect, it } from 'vitest';
import {
  calculateCartTotal,
  customerSchema,
  normalizePhoneNumber,
  orderSchema,
  productQuerySchema,
  type CartEntry,
} from '@tovarka/shared';
const customer = {
  customerName: 'Олена Коваль',
  phone: '067 123 45 67',
  email: '',
  deliveryMethod: 'post' as const,
  deliveryAddress: 'Київ, відділення 12',
};
describe('checkout validation', () => {
  it('normalizes Ukrainian numbers', () => {
    expect(normalizePhoneNumber('(067) 123-45-67')).toBe('+380671234567');
    expect(customerSchema.parse(customer).phone).toBe('+380671234567');
  });
  it.each([
    { phone: '123' },
    { customerName: ' ' },
    { email: 'bad-mail' },
    { deliveryAddress: '' },
    { comment: 'x'.repeat(1001) },
  ])('rejects invalid customer input %o', (input) => {
    expect(customerSchema.safeParse({ ...customer, ...input }).success).toBe(
      false,
    );
  });
  it('allows pickup without address and empty email', () => {
    expect(
      customerSchema.safeParse({
        ...customer,
        deliveryMethod: 'pickup',
        deliveryAddress: '',
      }).success,
    ).toBe(true);
  });
  it('rejects invalid IDs, quantities, duplicate lines and client prices', () => {
    const item = {
      productId: '8e009aa6-d1d5-4f52-9a99-66ef1c4782a1',
      quantity: 1,
    };
    for (const items of [
      [{ ...item, productId: 'unknown' }],
      [{ ...item, quantity: 0 }],
      [{ ...item, quantity: 1.5 }],
      [{ ...item, quantity: 100 }],
      [item, item],
      [{ ...item, price: 1 }],
      [],
    ])
      expect(orderSchema.safeParse({ customer, items }).success).toBe(false);
  });
});
describe('product queries', () => {
  it('parses pagination and sort', () => {
    expect(
      productQuerySchema.parse({ page: '2', limit: '6', sort: 'price-asc' }),
    ).toMatchObject({ page: 2, limit: 6 });
  });
  it.each([
    { page: '0' },
    { limit: '1000' },
    { sort: 'sql' },
    { search: ['x', 'y'] },
    { category: '../x' },
  ])('rejects malformed filters %o', (input) => {
    expect(productQuerySchema.safeParse(input).success).toBe(false);
  });
});
describe('money calculations', () => {
  it('sums integer minor units without floating point artifacts', () => {
    const items = [
      { product: { price: '0.10' }, quantity: 3 },
      { product: { price: '0.20' }, quantity: 1 },
    ] as CartEntry[];
    expect(calculateCartTotal(items)).toBe(50);
    expect(calculateCartTotal([])).toBe(0);
  });
});
