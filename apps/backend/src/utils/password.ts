import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, parameters, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}
const dummyHash = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
export async function verifyPassword(
  password: string,
  encoded: string = dummyHash,
): Promise<boolean> {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded);
  if (!match?.[1] || !match[2]) return false;
  const derived = await derive(password, Buffer.from(match[1], 'hex'));
  return timingSafeEqual(derived, Buffer.from(match[2], 'hex'));
}
export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
