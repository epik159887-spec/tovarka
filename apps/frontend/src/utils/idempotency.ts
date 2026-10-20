import type { OrderInput } from '@tovarka/shared';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
const storageKey = 'tovarka-checkout-attempt';
const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
let memory: { fingerprint: string; key: string } | null = null;

function getFingerprint(input: OrderInput): string {
  // Pure JavaScript hashing also works on HTTP origins without crypto.subtle.
  return bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(input))));
}
function createOrderKey(): string {
  const provider = globalThis.crypto;
  if (typeof provider?.randomUUID === 'function') return provider.randomUUID();
  if (typeof provider?.getRandomValues !== 'function') {
    throw new Error(
      'Браузер не підтримує безпечне оформлення. Оновіть браузер або відкрийте сайт через HTTPS.',
    );
  }
  // getRandomValues is available on HTTP origins, unlike randomUUID.
  const bytes = provider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function getOrderKey(input: OrderInput): string {
  const fingerprint = getFingerprint(input);
  if (memory?.fingerprint === fingerprint) return memory.key;
  const key = createOrderKey();
  memory = { fingerprint, key };
  return key;
}
export async function getPersistentOrderKey(
  input: OrderInput,
): Promise<string> {
  const fingerprint = getFingerprint(input);
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
  } catch {
    /* Storage may be unavailable or malformed. */
  }
  if (
    saved &&
    typeof saved === 'object' &&
    'fingerprint' in saved &&
    saved.fingerprint === fingerprint &&
    'key' in saved &&
    typeof saved.key === 'string' &&
    uuidPattern.test(saved.key)
  ) {
    memory = { fingerprint, key: saved.key };
    return saved.key;
  }
  const key = getOrderKey(input);
  try {
    // Persist only the digest and opaque key, never customer details.
    localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  } catch {
    /* Keep the in-memory key when browser storage is disabled. */
  }
  return key;
}
export function clearOrderKey() {
  memory = null;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* Storage can be disabled. */
  }
}
