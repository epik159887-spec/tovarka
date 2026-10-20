import { Prisma } from '@prisma/client';
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
  try {
    return await adminRepository.createProduct(
      input,
      `product-${randomUUID()}`,
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    )
      throw new AppError(
        400,
        'CATEGORY_NOT_FOUND',
        'Категорію вже видалено. Оберіть іншу категорію.',
      );
    throw error;
  }
}

export async function setAdminPassword(username: string, password: string) {
  z.string()
    .regex(/^[a-zA-Z0-9_-]{3,80}$/)
    .parse(username);
  z.string().min(12).max(128).parse(password);
  await adminRepository.setPassword(username, await hashPassword(password));
}

export async function deleteAdminOrder(id: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await adminRepository.deleteOrder(id);
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034'
      )
        throw error;
      if (attempt === 3)
        throw new AppError(
          503,
          'ORDER_BUSY',
          'Сервіс зайнятий. Спробуйте видалити замовлення ще раз.',
        );
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
  throw new Error('Unreachable deletion retry state');
}

export async function deleteAdminCatalogItem(
  kind: 'product' | 'category',
  id: string,
) {
  try {
    return await (kind === 'product'
      ? adminRepository.deleteProduct(id)
      : adminRepository.deleteCategory(id));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025')
        throw new AppError(
          404,
          'CATALOG_ITEM_NOT_FOUND',
          'Запис уже видалено або не знайдено.',
        );
      if (error.code === 'P2003' && kind === 'category')
        throw new AppError(
          409,
          'CATEGORY_NOT_EMPTY',
          'Спочатку видаліть товари цієї категорії, зокрема приховані.',
        );
    }
    throw error;
  }
}
