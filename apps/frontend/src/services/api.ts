import type {
  Category,
  OrderInput,
  OrderResult,
  Product,
  ProductPage,
} from '@tovarka/shared';
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      'Не вдалося зв’язатися з магазином. Перевірте з’єднання та повторіть спробу.',
      0,
      'NETWORK_ERROR',
    );
  }
  let payload: { data?: T; error?: { message?: string; code?: string } };
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      'Сервіс тимчасово недоступний. Спробуйте ще раз.',
      response.status,
      'INVALID_RESPONSE',
    );
  }
  if (!response.ok || payload.data === undefined)
    throw new ApiError(
      payload.error?.message ?? 'Не вдалося виконати запит',
      response.status,
      payload.error?.code ?? 'UNKNOWN',
    );
  return payload.data;
}
export const productApi = {
  list: (params: URLSearchParams) =>
    request<ProductPage>(`/products?${params}`),
  find: (id: string) => request<Product>(`/products/${id}`),
  categories: () => request<Category[]>('/categories'),
};
export const orderApi = {
  create: (input: OrderInput, key: string) =>
    request<OrderResult>('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(input),
    }),
};
