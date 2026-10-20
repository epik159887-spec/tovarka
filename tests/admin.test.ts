import { describe, expect, it } from 'vitest';
import { createProductSchema, productImageSchema } from '@tovarka/shared';
import {
  hashPassword,
  verifyPassword,
} from '../apps/backend/src/utils/password.js';
const input = {
  name: 'Горнятко',
  description: 'Керамічне горнятко',
  price: '480.50',
  stock: 2,
  categoryId: '10000000-0000-4000-8000-000000000001',
  imageUrl: '/uploads/1234.png',
  active: true,
};
describe('admin product validation', () => {
  it('accepts uploaded and external photos', () => {
    expect(createProductSchema.safeParse(input).success).toBe(true);
    expect(
      productImageSchema.safeParse('https://example.com/photo.jpg').success,
    ).toBe(true);
  });
  it.each([
    { price: '-1' },
    { price: '0' },
    { price: '1.001' },
    { stock: -1 },
    { stock: 1.5 },
    { categoryId: 'wrong' },
    { imageUrl: 'javascript:alert(1)' },
    { imageUrl: '/uploads/../../.env' },
    { imageUrl: 'https://user:password@example.com/photo.jpg' },
  ])('rejects invalid products %o', (change) =>
    expect(createProductSchema.safeParse({ ...input, ...change }).success).toBe(
      false,
    ),
  );
});
describe('admin password storage', () => {
  it('salts passwords and verifies them without storing plaintext', async () => {
    const first = await hashPassword('test-password-with-length');
    const second = await hashPassword('test-password-with-length');
    expect(first).not.toBe(second);
    expect(first).not.toContain('test-password');
    expect(await verifyPassword('test-password-with-length', first)).toBe(true);
    expect(await verifyPassword('incorrect', first)).toBe(false);
  });
  it('rejects absent and malformed password hashes', async () => {
    expect(await verifyPassword('incorrect')).toBe(false);
    expect(await verifyPassword('incorrect', 'malformed')).toBe(false);
  });
});

describe('product gallery validation', () => {
  it('supports old single-image requests and puts the cover first without duplicates', () => {
    expect(createProductSchema.parse(input).imageUrls).toEqual([
      input.imageUrl,
    ]);
    expect(
      createProductSchema.parse({
        ...input,
        imageUrls: ['/images/vase.svg', input.imageUrl],
      }).imageUrls,
    ).toEqual([input.imageUrl, '/images/vase.svg']);
  });
  it('accepts ten images including the cover and rejects oversized galleries', () => {
    const photos = Array.from(
      { length: 10 },
      (_, i) => `https://example.com/${i}.jpg`,
    );
    expect(
      createProductSchema.safeParse({
        ...input,
        imageUrl: photos[0],
        imageUrls: photos,
      }).success,
    ).toBe(true);
    expect(
      createProductSchema.safeParse({ ...input, imageUrls: photos }).success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({
        ...input,
        imageUrl: photos[0],
        imageUrls: [...photos, 'https://example.com/11.jpg'],
      }).success,
    ).toBe(false);
  });
  it('validates every additional image', () => {
    expect(
      createProductSchema.safeParse({
        ...input,
        imageUrls: ['javascript:alert(1)'],
      }).success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({
        ...input,
        imageUrls: ['/uploads/../../.env'],
      }).success,
    ).toBe(false);
  });
});
