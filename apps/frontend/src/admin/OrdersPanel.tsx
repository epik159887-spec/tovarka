import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ArrowUpRight, PackageOpen, Trash2 } from 'lucide-react';
import type { AdminOrder, AdminOrderPage } from '@tovarka/shared';
import { OrderDetails } from './OrderDetails';
import { DeleteOrderDialog } from './DeleteOrderDialog';
import { formatOrderDate as formatDate } from './order-format';
import { adminApi } from './api';
import { Button, LoadingState, ErrorState, EmptyState } from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';
export function OrdersPanel() {
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [deleting, setDeleting] = useState<AdminOrder | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const orders = useQuery({
    queryKey: ['admin', 'orders', page, query],
    queryFn: () => adminApi.orders(page, query),
    refetchInterval: 30000,
    retry: false,
  });
  return (
    <section className="admin-card">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">УСІ ЗАМОВЛЕННЯ В ОДНОМУ МІСЦІ</p>
          <h2>Замовлення</h2>
        </div>
        <label className="admin-search">
          <Search size={17} />
          <span className="sr-only">Пошук замовлень</span>
          <input
            placeholder="Номер, ім’я або телефон"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {orders.isPending ? (
        <LoadingState />
      ) : orders.isError ? (
        <ErrorState
          message={getErrorMessage(orders.error)}
          retry={() => void orders.refetch()}
        />
      ) : orders.data.orders.length ? (
        <>
          <div className="admin-table-scroll">
            <table className="admin-orders-table">
              <thead>
                <tr>
                  <th>Замовлення</th>
                  <th>Покупець</th>
                  <th>Товарів</th>
                  <th>Сума</th>
                  <th>
                    <span className="sr-only">Дії</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber.slice(0, 11)}…</strong>
                      <span>{formatDate(order.createdAt)}</span>
                    </td>
                    <td>
                      <strong>{order.customerName}</strong>
                      <span>{order.phone}</span>
                    </td>
                    <td>
                      {order.items.reduce(
                        (count, item) => count + item.quantity,
                        0,
                      )}
                    </td>
                    <td className="admin-money">
                      {formatCurrency(order.total)}
                    </td>
                    <td>
                      <div className="admin-order-actions">
                        <button
                          className="admin-details-button"
                          onClick={() => setSelected(order)}
                          aria-label={`Переглянути замовлення ${order.orderNumber}`}
                        >
                          Деталі <ArrowUpRight size={16} />
                        </button>
                        <button
                          className="admin-delete-button"
                          onClick={() => setDeleting(order)}
                          aria-label={`Видалити замовлення ${order.orderNumber}`}
                        >
                          <Trash2 size={16} /> Видалити
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Усього: {orders.data.total}</span>
            <div>
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </Button>
              <span>
                {page} / {orders.data.pages}
              </span>
              <Button
                variant="secondary"
                disabled={page === orders.data.pages}
                onClick={() => setPage(page + 1)}
              >
                Далі
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState>
          <PackageOpen size={30} />
          <h3>{query ? 'Нічого не знайдено' : 'Замовлень поки немає'}</h3>
          <p>
            {query
              ? 'Спробуйте інший номер, ім’я або телефон.'
              : 'Нові замовлення з магазину з’являтимуться тут.'}
          </p>
        </EmptyState>
      )}
      {deleting && (
        <DeleteOrderDialog
          order={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            const refreshed = cache.getQueryData<AdminOrderPage>([
              'admin',
              'orders',
              page,
              query,
            ]);
            if (refreshed && page > Math.max(1, refreshed.pages))
              setPage(Math.max(1, refreshed.pages));
            if (selected?.id === deleting.id) setSelected(null);
          }}
        />
      )}
      {selected && (
        <OrderDetails order={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
