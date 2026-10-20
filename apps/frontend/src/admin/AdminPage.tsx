import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  PackagePlus,
  ArrowUpRight,
  LogOut,
  Package,
  ReceiptText,
  Clock3,
  Wallet,
} from 'lucide-react';
import type { AdminIdentity } from '@tovarka/shared';
import { adminApi } from './api';
import { LoginForm } from './LoginForm';
import { OrdersPanel } from './OrdersPanel';
import { CatalogPanel } from './CatalogPanel';
import { ProductForm } from './ProductForm';
import { LoadingState, ErrorState } from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';
import './admin.css';
export default function AdminPage() {
  const client = useQueryClient();
  const [tab, setTab] = useState<'orders' | 'product' | 'catalog'>('orders');
  const session = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: adminApi.session,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    enabled: !!session.data,
    retry: false,
    refetchInterval: 30000,
  });
  const clearSession = () => {
    void client.cancelQueries({ queryKey: ['admin'] });
    client.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === 'admin' && query.queryKey[1] !== 'session',
    });
    client.setQueryData(['admin', 'session'], null);
  };
  useEffect(() => {
    const expired = () => {
      void client.cancelQueries({ queryKey: ['admin'] });
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'admin' && query.queryKey[1] !== 'session',
      });
      client.setQueryData(['admin', 'session'], null);
    };
    window.addEventListener('admin-session-expired', expired);
    return () => window.removeEventListener('admin-session-expired', expired);
  }, [client]);
  useEffect(() => {
    if (session.data === null)
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === 'admin' && query.queryKey[1] !== 'session',
      });
  }, [session.data, client]);
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSuccess: clearSession,
  });
  const onLogin = (identity: AdminIdentity) => {
    client.setQueryData(['admin', 'session'], identity);
    setTab('orders');
  };
  if (session.isPending) return <LoadingState />;
  if (session.isError)
    return (
      <ErrorState
        message={getErrorMessage(session.error)}
        retry={() => void session.refetch()}
      />
    );
  if (!session.data) return <LoginForm onSuccess={onLogin} />;
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-container">
          <a className="brand" href="/">
            товарка<span>●</span>
          </a>
          <span className="admin-header-label">Керування магазином</span>
          <div className="admin-header-actions">
            <a href="/">
              До магазину <ArrowUpRight size={16} />
            </a>
            <button
              aria-label="Вийти"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut size={17} />
              <span>Вийти</span>
            </button>
          </div>
        </div>
      </header>
      <main className="admin-container admin-main">
        <div className="admin-welcome">
          <div>
            <p className="eyebrow">ВАШ МАГАЗИН ПІД РУКОЮ</p>
            <h1>
              Вітаємо, <em>{session.data.username}.</em>
            </h1>
            <p>Замовлення, покупці та нові речі для вашої колекції.</p>
          </div>
          <span className="admin-secure-badge">Захищений доступ</span>
        </div>
        {logout.isError && (
          <p className="form-error" role="alert">
            {getErrorMessage(logout.error)}
          </p>
        )}
        {stats.isError ? (
          <ErrorState
            message={getErrorMessage(stats.error)}
            retry={() => void stats.refetch()}
          />
        ) : (
          <div className="admin-stats">
            {[
              {
                title: 'Усього замовлень',
                value: stats.data?.orders,
                icon: ReceiptText,
              },
              {
                title: 'За останні 24 години',
                value: stats.data?.recentOrders,
                icon: Clock3,
              },
              {
                title: 'Сума замовлень',
                value: stats.data
                  ? formatCurrency(stats.data.orderTotal)
                  : undefined,
                icon: Wallet,
              },
              {
                title: 'Товарів у базі',
                value: stats.data?.products,
                icon: Package,
              },
            ].map(({ title, value, icon: Icon }) => (
              <article key={title}>
                <div>
                  <span>{title}</span>
                  <Icon size={19} strokeWidth={1.5} />
                </div>
                <strong>{value ?? '…'}</strong>
              </article>
            ))}
          </div>
        )}
        <nav className="admin-tabs" aria-label="Розділи адмінпанелі">
          <button
            aria-pressed={tab === 'orders'}
            onClick={() => setTab('orders')}
          >
            <ShoppingBag size={18} /> Замовлення
          </button>
          <button
            aria-pressed={tab === 'product'}
            onClick={() => setTab('product')}
          >
            <PackagePlus size={18} /> Додати товар
          </button>
          <button
            aria-pressed={tab === 'catalog'}
            onClick={() => setTab('catalog')}
          >
            <Package size={18} /> Товари й категорії
          </button>
        </nav>
        {tab === 'orders' ? (
          <OrdersPanel />
        ) : tab === 'catalog' ? (
          <CatalogPanel />
        ) : (
          <ProductForm />
        )}
        <p className="admin-footer-note">
          Товарка · Замовлення та контакти покупців доступні лише після входу.
        </p>
      </main>
    </div>
  );
}
