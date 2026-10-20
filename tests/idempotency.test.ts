import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderInput } from '@tovarka/shared';
const input: OrderInput = {
  customer: {
    customerName: 'Тестова Покупчиня',
    phone: '+380671234567',
    deliveryMethod: 'pickup',
  },
  items: [{ productId: '10000000-0000-4000-8000-000000000001', quantity: 1 }],
};
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
let storage: Map<string, string>;
let module: typeof import('../apps/frontend/src/utils/idempotency');
beforeEach(async () => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('crypto', {
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  });
  module = await import('../apps/frontend/src/utils/idempotency');
});
afterEach(() => vi.unstubAllGlobals());
describe('checkout keys on HTTP origins', () => {
  it('also uses native UUID generation when available', async () => {
    const key = '10000000-0000-4000-8000-000000000001';
    const native = vi.fn(() => key);
    vi.stubGlobal('crypto', { randomUUID: native });
    expect(await module.getPersistentOrderKey(input)).toBe(key);
    expect(native).toHaveBeenCalledOnce();
  });
  it('creates valid secure-random UUIDs without subtle or randomUUID', async () => {
    expect(globalThis.crypto.subtle).toBeUndefined();
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    const key = await module.getPersistentOrderKey(input);
    expect(key).toMatch(uuidPattern);
    expect(await module.getPersistentOrderKey(input)).toBe(key);
  });
  it('persists the same SHA-256 digest as Web Crypto without customer details', async () => {
    await module.getPersistentOrderKey(input);
    const value = storage.get('tovarka-checkout-attempt')!;
    expect(JSON.parse(value).fingerprint).toBe(digest);
    expect(value).not.toContain(input.customer.customerName);
    expect(value).not.toContain(input.customer.phone);
  });
  it('reuses an existing key after page reload or an upgrade', async () => {
    const key = '10000000-0000-4000-8000-000000000001';
    storage.set(
      'tovarka-checkout-attempt',
      JSON.stringify({ fingerprint: digest, key }),
    );
    expect(await module.getPersistentOrderKey(input)).toBe(key);
    vi.resetModules();
    const reloaded = await import('../apps/frontend/src/utils/idempotency');
    expect(await reloaded.getPersistentOrderKey(input)).toBe(key);
  });
  it('keeps a restored key when storage later becomes unavailable', async () => {
    const key = await module.getPersistentOrderKey(input);
    vi.resetModules();
    const reloaded = await import('../apps/frontend/src/utils/idempotency');
    expect(await reloaded.getPersistentOrderKey(input)).toBe(key);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(await reloaded.getPersistentOrderKey(input)).toBe(key);
  });
  it('reuses in-memory keys when storage is unavailable from the start', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    const key = await module.getPersistentOrderKey(input);
    expect(await module.getPersistentOrderKey(input)).toBe(key);
  });
  it('generates a new key when the order changes or succeeds', async () => {
    const key = await module.getPersistentOrderKey(input);
    const changed = { ...input, items: [{ ...input.items[0]!, quantity: 2 }] };
    expect(await module.getPersistentOrderKey(changed)).not.toBe(key);
    module.clearOrderKey();
    expect(storage.size).toBe(0);
    expect(await module.getPersistentOrderKey(input)).not.toBe(key);
  });
  it.each(['not-a-uuid', ''])(
    'replaces malformed stored keys %s',
    async (key) => {
      storage.set(
        'tovarka-checkout-attempt',
        JSON.stringify({ fingerprint: digest, key }),
      );
      expect(await module.getPersistentOrderKey(input)).toMatch(uuidPattern);
    },
  );
  it('repairs malformed stored JSON and preserves the new key across reloads', async () => {
    storage.set('tovarka-checkout-attempt', '{bad-json');
    const key = await module.getPersistentOrderKey(input);
    expect(key).toMatch(uuidPattern);
    expect(JSON.parse(storage.get('tovarka-checkout-attempt')!).key).toBe(key);
    vi.resetModules();
    const reloaded = await import('../apps/frontend/src/utils/idempotency');
    expect(await reloaded.getPersistentOrderKey(input)).toBe(key);
  });
  it('keeps the key when storage writes fail', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    const key = await module.getPersistentOrderKey(input);
    expect(await module.getPersistentOrderKey(input)).toBe(key);
  });
  it('returns one key for concurrent retries', async () => {
    const keys = await Promise.all(
      Array.from({ length: 5 }, () => module.getPersistentOrderKey(input)),
    );
    expect(new Set(keys).size).toBe(1);
  });
  it('reports a Ukrainian error instead of using insecure randomness', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(module.getPersistentOrderKey(input)).rejects.toThrow(
      'Браузер не підтримує безпечне оформлення',
    );
  });
});
