import { useState } from 'react';
import { ShoppingBag, Menu, X, ArrowUpRight } from 'lucide-react';
import { useCart } from '../hooks/useCart';
export function Brand() {
  return (
    <a href="#home" className="brand" aria-label="Товарка — на початок">
      товарка<span>●</span>
    </a>
  );
}
export function Header({ onCart }: { onCart: () => void }) {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="announcement">
        Маленькі речі. Багато тепла.{' '}
        <span>
          Знайдіть щось своє <ArrowUpRight size={13} />
        </span>
      </div>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav
            className={open ? 'navigation open' : 'navigation'}
            aria-label="Головна навігація"
          >
            {[
              ['#catalog', 'Колекція'],
              ['#about', 'Про нас'],
              ['#how', 'Як замовити'],
              ['#contacts', 'Контакти'],
            ].map(([href, label]) => (
              <a href={href} key={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="cart-trigger"
              onClick={onCart}
              aria-label={`Відкрити кошик, товарів: ${count}`}
            >
              <ShoppingBag size={20} />
              <span>Кошик</span>
              <b>{count}</b>
            </button>
            <button
              className="icon-button mobile-menu"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
