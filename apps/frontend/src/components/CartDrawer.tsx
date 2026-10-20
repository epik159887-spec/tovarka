import { useState } from 'react';
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
import type { CartEntry } from '@tovarka/shared';
import { useCart } from '../hooks/useCart';
import { productApi, ApiError } from '../services/api';
import { formatCurrency, getErrorMessage } from '../utils/format';
import { Button, EmptyState, Modal } from './ui';
function CartItem({ item }: { item: CartEntry }) {
  const { update, remove } = useCart();
  return (
    <article className="cart-item">
      <img src={item.product.imageUrl} alt={item.product.name} />
      <div className="cart-item-info">
        <h3>{item.product.name}</h3>
        <p>{formatCurrency(item.product.price)}</p>
        <div className="quantity-control">
          <button
            aria-label={`Зменшити кількість ${item.product.name}`}
            disabled={item.quantity <= 1}
            onClick={() => update(item.product.id, item.quantity - 1)}
          >
            <Minus size={14} />
          </button>
          <span aria-live="polite">{item.quantity}</span>
          <button
            aria-label={`Збільшити кількість ${item.product.name}`}
            disabled={item.quantity >= Math.min(item.product.stock, 99)}
            onClick={() => update(item.product.id, item.quantity + 1)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <button
        className="icon-button remove-item"
        aria-label={`Видалити ${item.product.name}`}
        onClick={() => remove(item.product.id)}
      >
        <Trash2 size={17} />
      </button>
    </article>
  );
}
export function CartDrawer({
  onClose,
  onCheckout,
}: {
  onClose: () => void;
  onCheckout: () => void;
}) {
  const { items, total, clear, synchronize } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      const results = await Promise.all(
        items.map((i) =>
          productApi.find(i.product.id).catch((error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;
            throw error;
          }),
        ),
      );
      synchronize(results.filter((p) => p !== null));
      setError('Ціни та залишки оновлено. Перевірте склад кошика.');
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Ваш кошик" onClose={onClose} drawer busy={busy}>
      <div className="cart-content">
        {items.length ? (
          <>
            <div className="cart-items">
              {items.map((item) => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>
            <div className="cart-actions">
              <button onClick={clear} disabled={busy}>
                Очистити кошик
              </button>
              <button onClick={() => void refresh()} disabled={busy}>
                {busy ? 'Оновлюємо…' : 'Оновити ціни й залишки'}
              </button>
            </div>
            {error && (
              <p className="cart-notice" role="status">
                {error}
              </p>
            )}
            <div className="cart-summary">
              <div>
                <span>Товари</span>
                <strong>{formatCurrency(total / 100)}</strong>
              </div>
              <p>
                Доставка за тарифами перевізника. Остаточну суму товарів
                перевіримо під час оформлення.
              </p>
              <Button onClick={onCheckout} disabled={busy}>
                Оформити замовлення <ArrowRight size={18} />
              </Button>
              <button className="text-button" onClick={onClose}>
                Продовжити покупки
              </button>
            </div>
          </>
        ) : (
          <EmptyState>
            <ShoppingBag size={30} />
            <h3>Тут ще трохи порожньо</h3>
            <p>Додайте речі, що зроблять ваш дім затишнішим.</p>
            <Button onClick={onClose}>До колекції</Button>
          </EmptyState>
        )}
      </div>
    </Modal>
  );
}
