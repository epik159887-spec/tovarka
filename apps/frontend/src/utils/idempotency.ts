import type { OrderInput } from '@tovarka/shared';
const storageKey = 'tovarka-checkout-attempt';
let memory: { fingerprint: string; key: string } | null = null;
export function getOrderKey(input: OrderInput): string {
  const fingerprint = JSON.stringify(input);
  // Persist only a digest, never customer details.
  if (memory?.fingerprint === fingerprint) return memory.key;
  const key = crypto.randomUUID();
  memory = { fingerprint, key };
  return key;
}
export async function getPersistentOrderKey(
  input: OrderInput,
): Promise<string> {
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify(input)),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? 'null',
    );
    if (
      saved &&
      typeof saved === 'object' &&
      'fingerprint' in saved &&
      saved.fingerprint === fingerprint &&
      'key' in saved &&
      typeof saved.key === 'string'
    )
      return saved.key;
    const key = getOrderKey(input);
    localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
    return key;
  } catch {
    return getOrderKey(input);
  }
}
export function clearOrderKey() {
  memory = null;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* Storage can be disabled. */
  }
}
