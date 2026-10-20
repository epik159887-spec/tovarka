import { randomBytes, randomUUID } from 'node:crypto';
import { adminRepository } from '../repositories/admin.repository.js';
import {
  verifyPassword,
  hashPassword,
  hashSessionToken,
} from '../utils/password.js';
import { AppError } from '../utils/errors.js';
import { z, type AdminLogin, type CreateProductInput } from '@tovarka/shared';
export const adminSessionDuration = 8 * 60 * 60 * 1000;
export async function loginAdmin(input: AdminLogin) {
  const user = await adminRepository.user(input.username);
  const valid = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !valid)
    throw new AppError(401, 'ADMIN_LOGIN_FAILED', 'Невірний логін або пароль');
  const token = randomBytes(32).toString('base64url');
  await adminRepository.createSession(
    user.id,
    hashSessionToken(token),
    new Date(Date.now() + adminSessionDuration),
  );
  return { token, username: user.username };
}
export async function createAdminProduct(input: CreateProductInput) {
  if (!(await adminRepository.category(input.categoryId)))
    throw new AppError(
      400,
      'CATEGORY_NOT_FOUND',
      'Категорію не знайдено. Оновіть сторінку.',
    );
  return adminRepository.createProduct(input, `product-${randomUUID()}`);
}

export async function setAdminPassword(username: string, password: string) {
  z.string()
    .regex(/^[a-zA-Z0-9_-]{3,80}$/)
    .parse(username);
  z.string().min(12).max(128).parse(password);
  await adminRepository.setPassword(username, await hashPassword(password));
}
