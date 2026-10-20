import { deliveryLabels, type AdminOrder } from '@tovarka/shared';
import { Modal } from '../components/ui';
import { formatCurrency } from '../utils/format';
import { formatOrderDate as formatDate } from './order-format';
const notificationLabels: Record<string, string> = {
  PENDING: 'Очікує надсилання',
  PROCESSING: 'Надсилається',
  SENT: 'Надіслано',
  FAILED: 'Помилка надсилання',
  UNKNOWN: 'Потребує перевірки',
};
export function OrderDetails({
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
