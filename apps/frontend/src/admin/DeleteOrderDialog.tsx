import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminOrder } from '@tovarka/shared';
import { Button, Modal } from '../components/ui';
import { getErrorMessage } from '../utils/format';
import { adminApi } from './api';
export function DeleteOrderDialog({
  order,
  onClose,
  onDeleted,
}: {
  order: AdminOrder;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const cache = useQueryClient();
  const deletion = useMutation({
    mutationFn: () => adminApi.deleteOrder(order.id),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        cache.invalidateQueries({ queryKey: ['admin', 'stats'] }),
      ]);
      onDeleted();
    },
  });
  return (
    <Modal
      title="Видалити замовлення?"
      onClose={onClose}
      busy={deletion.isPending}
    >
      <div className="admin-delete-confirm">
        <p className="admin-order-number">{order.orderNumber}</p>
        <p>
          Замовлення, його товари та контакти покупця буде видалено без
          можливості відновлення.
        </p>
        <p className="muted">
          Залишки товарів не зміняться. Уже надіслані повідомлення в Telegram
          залишаться в чаті.
        </p>
        {deletion.isError && (
          <p className="field-error" role="alert">
            {getErrorMessage(deletion.error)}
          </p>
        )}
        <div className="admin-order-actions">
          <Button
            variant="secondary"
            disabled={deletion.isPending}
            onClick={onClose}
            autoFocus
          >
            Скасувати
          </Button>
          <Button
            className="button-danger"
            disabled={deletion.isPending}
            onClick={() => deletion.mutate()}
          >
            {deletion.isPending ? 'Видаляємо…' : 'Так, видалити'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
