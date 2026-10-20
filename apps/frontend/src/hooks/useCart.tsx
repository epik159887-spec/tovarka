import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import {
  calculateCartTotal,
  productImageSchema,
  type CartEntry,
  type Product,
} from '@tovarka/shared';
const entrySchema = z.object({
  product: z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    price: z.string().regex(/^\d+(\.\d{1,2})?$/),
    imageUrl: productImageSchema,
    stock: z.number().int().min(0),
    category: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable(),
    }),
  }),
  quantity: z.number().int().min(1).max(99),
});
function loadCart(): CartEntry[] {
  try {
    const result = z
      .array(entrySchema)
      .max(50)
      .safeParse(JSON.parse(localStorage.getItem('tovarka-cart') ?? '[]'));
    return result.success
      ? result.data
          .filter((i) => i.product.stock > 0)
          .map((i) => ({
            ...i,
            quantity: Math.min(i.quantity, i.product.stock),
          }))
      : [];
  } catch {
    return [];
  }
}
interface CartContextValue {
  items: CartEntry[];
  count: number;
  total: number;
  add: (product: Product) => void;
  update: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  synchronize: (products: Product[]) => void;
}
const CartContext = createContext<CartContextValue | null>(null);
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartEntry[]>(loadCart);
  useEffect(() => {
    try {
      localStorage.setItem('tovarka-cart', JSON.stringify(items));
    } catch {
      /* Continue with in-memory cart. */
    }
  }, [items]);
  const add = useCallback(
    (product: Product) =>
      setItems((current) => {
        if (
          product.stock < 1 ||
          (current.length >= 50 &&
            !current.some((i) => i.product.id === product.id))
        )
          return current;
        const found = current.find((i) => i.product.id === product.id);
        return found
          ? current.map((i) =>
              i.product.id === product.id
                ? {
                    product,
                    quantity: Math.min(i.quantity + 1, product.stock, 99),
                  }
                : i,
            )
          : [...current, { product, quantity: 1 }];
      }),
    [],
  );
  const update = useCallback(
    (id: string, quantity: number) =>
      setItems((current) =>
        current.map((i) =>
          i.product.id === id
            ? {
                ...i,
                quantity: Math.max(1, Math.min(quantity, i.product.stock, 99)),
              }
            : i,
        ),
      ),
    [],
  );
  const remove = useCallback(
    (id: string) =>
      setItems((current) => current.filter((i) => i.product.id !== id)),
    [],
  );
  const clear = useCallback(() => setItems([]), []);
  const synchronize = useCallback(
    (products: Product[]) =>
      setItems((current) =>
        current.flatMap((i) => {
          const product = products.find((p) => p.id === i.product.id);
          return product && product.stock > 0
            ? [{ product, quantity: Math.min(i.quantity, product.stock, 99) }]
            : [];
        }),
      ),
    [],
  );
  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      total: calculateCartTotal(items),
      add,
      update,
      remove,
      clear,
      synchronize,
    }),
    [items, add, update, remove, clear, synchronize],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('CartProvider is required');
  return context;
}
