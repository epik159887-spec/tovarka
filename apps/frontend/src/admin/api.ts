import type {
  AdminIdentity,
  AdminLogin,
  AdminStats,
  AdminOrderPage,
  AdminProduct,
  CreateProductInput,
  Category,
} from '@tovarka/shared';
import { ApiError, request } from '../services/api';
async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(`/admin${path}`, init);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      path !== '/login' &&
      path !== '/session'
    )
      window.dispatchEvent(new Event('admin-session-expired'));
    throw error;
  }
}
const post = <T>(path: string, body: unknown) =>
  adminRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
    body: JSON.stringify(body),
  });
export const adminApi = {
  session: async () => {
    try {
      return await adminRequest<AdminIdentity>('/session');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  login: (input: AdminLogin) => post<AdminIdentity>('/login', input),
  logout: () => post<null>('/logout', {}),
  stats: () => adminRequest<AdminStats>('/stats'),
  orders: (page: number, search: string) =>
    adminRequest<AdminOrderPage>(
      `/orders?${new URLSearchParams({ page: String(page), search, limit: '10' })}`,
    ),
  createProduct: (input: CreateProductInput) =>
    post<AdminProduct>('/products', input),
  createCategory: (name: string) => post<Category>('/categories', { name }),
  upload: (file: File) => {
    const body = new FormData();
    body.append('image', file);
    return adminRequest<{ imageUrl: string }>('/uploads', {
      method: 'POST',
      headers: { 'X-Admin-Request': '1' },
      body,
    });
  },
};
