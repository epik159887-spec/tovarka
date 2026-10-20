import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ArrowUpRight, PackageOpen } from 'lucide-react';
import { deliveryLabels, type AdminOrder } from '@tovarka/shared';
import { adminApi } from './api';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Modal,
} from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';
const formatDate = (date: string) =>
  new Date(date).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'short',
    timeStyle: 'short',
  });
const notificationLabels: Record<string, string> = {
  PENDING: 'Очікує надсилання',
  PROCESSING: 'Надсилається',
  SENT: 'Надіслано',
  FAILED: 'Помилка надсилання',
  UNKNOWN: 'Потребує перевірки',
};
function OrderDetails({
  order,
  onClose,
}: {
  order: AdminOrder;
  onClose: () => void;
}) {
  return (
    <Modal title="Деталі замовлення" onClose={onClose}>
      <div className="admin-order-detail">
        <div className="admin-order-number">{order.orderNumber}</div>
        <p className="muted">{formatDate(order.createdAt)}</p>
        <dl className="admin-customer">
          <div>
            <dt>Покупець</dt>
            <dd>{order.customerName}</dd>
          </div>
          <div>
            <dt>Телефон</dt>
            <dd>
              <a href={`tel:${order.phone}`}>{order.phone}</a>
            </dd>
          </div>
          {order.email && (
            <div>
              <dt>Електронна пошта</dt>
              <dd>
                <a href={`mailto:${order.email}`}>{order.email}</a>
              </dd>
            </div>
          )}
          <div>
            <dt>Доставка</dt>
            <dd>
              {deliveryLabels[
                order.deliveryMethod as keyof typeof deliveryLabels
              ] ?? 'Не вказано'}
            </dd>
          </div>
          {order.deliveryAddress && (
            <div>
              <dt>Адреса</dt>
              <dd>{order.deliveryAddress}</dd>
            </div>
          )}
          {order.comment && (
            <div>
              <dt>Коментар</dt>
              <dd>{order.comment}</dd>
            </div>
          )}
          <div>
            <dt>Сповіщення Telegram</dt>
            <dd>
              {notificationLabels[order.notification?.status ?? ''] ??
                'Не створено'}
            </dd>
          </div>
        </dl>
        <h3>Що замовили</h3>
        <div className="admin-order-lines">
          {order.items.map((item) => (
            <div key={item.id}>
              <div>
                <strong>{item.productName}</strong>
                <p>
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <span>{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="checkout-total">
          <span>Сума товарів</span>
          <strong>{formatCurrency(order.total)}</strong>
        </div>
        <p className="muted">
          Доставка й оплата узгоджуються окремо. Сума товарів не є
          підтвердженням оплати.
        </p>
      </div>
    </Modal>
  );
}
export function OrdersPanel() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
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
                    <span className="sr-only">Перегляд</span>
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
                      <button
                        className="admin-details-button"
                        onClick={() => setSelected(order)}
                        aria-label={`Переглянути замовлення ${order.orderNumber}`}
                      >
                        Деталі <ArrowUpRight size={16} />
                      </button>
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
      {selected && (
        <OrderDetails order={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
