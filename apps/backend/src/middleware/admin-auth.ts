import type { Request, RequestHandler, CookieOptions } from 'express';
import { env } from '../config/env.js';
import { adminRepository } from '../repositories/admin.repository.js';
import { hashSessionToken } from '../utils/password.js';
import { AppError } from '../utils/errors.js';
import { adminSessionDuration } from '../services/admin.service.js';
export const adminCookieName =
  env.NODE_ENV === 'production' ? '__Host-tovarka_admin' : 'tovarka_admin';
export const adminCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: adminSessionDuration,
};
export function readAdminToken(req: Request): string | null {
  const value = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminCookieName}=`))
    ?.slice(adminCookieName.length + 1);
  return value && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : null;
}
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const token = readAdminToken(req);
  const session = token
    ? await adminRepository.session(hashSessionToken(token))
    : null;
  if (!session)
    throw new AppError(
      401,
      'ADMIN_UNAUTHORIZED',
      'Увійдіть до адміністративної панелі',
    );
  res.locals.admin = { username: session.admin.username };
  next();
};
export const requireAdminOrigin: RequestHandler = (req, _res, next) => {
  if (
    req.get('Origin') !== new URL(env.FRONTEND_URL).origin ||
    req.get('X-Admin-Request') !== '1'
  )
    throw new AppError(
      403,
      'ADMIN_ORIGIN_REJECTED',
      'Запит заблоковано. Відкрийте панель за правильною адресою магазину.',
    );
  next();
};
