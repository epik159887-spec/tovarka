import { Check, Plus } from 'lucide-react';
import type { Product } from '@tovarka/shared';
import { useCart } from '../hooks/useCart';
import { formatCurrency } from '../utils/format';
export function ProductCard({
  product,
  onAdded,
}: {
  product: Product;
  onAdded: (name: string) => void;
}) {
  const { add, items } = useCart();
  const quantity =
    items.find((i) => i.product.id === product.id)?.quantity ?? 0;
  const disabled =
    product.stock < 1 ||
    quantity >= Math.min(product.stock, 99) ||
    (quantity === 0 && items.length >= 50);
  return (
    <article className="product-card">
      <div className={`product-image image-${product.category.slug}`}>
        <img
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          width="600"
          height="600"
        />
        {product.stock === 0 ? (
          <span className="product-badge">Очікуємо на поповнення</span>
        ) : (
          <span className="product-category">{product.category.name}</span>
        )}
      </div>
      <div className="product-details">
        <div className="product-heading">
          <h3>{product.name}</h3>
          <p>{formatCurrency(product.price)}</p>
        </div>
        <p className="product-description">{product.description}</p>
        <div className="product-bottom">
          <span className={`stock ${product.stock === 0 ? 'sold-out' : ''}`}>
            <span />
            {product.stock > 0 ? 'Є в наявності' : 'Немає в наявності'}
          </span>
          <button
            className="add-button"
            aria-label={`Додати ${product.name} до кошика`}
            disabled={disabled}
            onClick={() => {
              add(product);
              onAdded(product.name);
            }}
          >
            {quantity > 0 ? <Check size={17} /> : <Plus size={18} />}
            <span>
              {disabled && product.stock > 0 ? 'У кошику' : 'До кошика'}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
