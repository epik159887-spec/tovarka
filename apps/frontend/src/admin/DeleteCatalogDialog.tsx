import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from './api';
import { Button, Modal } from '../components/ui';
import { getErrorMessage } from '../utils/format';
export interface CatalogTarget {
  kind: 'product' | 'category';
  id: string;
  name: string;
  productCount?: number;
}
export function DeleteCatalogDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: CatalogTarget;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const cache = useQueryClient();
  const blocked = target.kind === 'category' && !!target.productCount;
  const deletion = useMutation({
    mutationFn: () => adminApi.deleteCatalogItem(target.kind, target.id),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['admin', 'products'] }),
        cache.invalidateQueries({ queryKey: ['admin', 'categories'] }),
        cache.invalidateQueries({ queryKey: ['admin', 'stats'] }),
        cache.invalidateQueries({ queryKey: ['products'] }),
        cache.invalidateQueries({ queryKey: ['categories'] }),
      ]);
      // Product details can be cached by cart synchronization.
      cache.removeQueries({ queryKey: ['product', target.id] });
      onDeleted();
    },
  });
  return (
    <Modal
      title={
        target.kind === 'product' ? 'Видалити товар?' : 'Видалити категорію?'
      }
      onClose={onClose}
      busy={deletion.isPending}
    >
      <div className="admin-delete-confirm">
        <strong>{target.name}</strong>
        <p>
          {target.kind === 'product'
            ? 'Товар зникне з магазину та адмінпанелі без можливості відновлення. Дані про нього в попередніх замовленнях збережуться.'
            : blocked
              ? `У цій категорії ще є товари: ${target.productCount}. Спочатку видаліть їх, зокрема приховані.`
              : 'Категорію буде видалено без можливості відновлення.'}
        </p>
        {deletion.isError && (
          <p className="field-error" role="alert">
            {getErrorMessage(deletion.error)}
          </p>
        )}
        <div className="admin-order-actions">
          <Button
            variant="secondary"
            autoFocus
            disabled={deletion.isPending}
            onClick={onClose}
          >
            Скасувати
          </Button>
          <Button
            className="button-danger"
            disabled={deletion.isPending || blocked}
            onClick={() => deletion.mutate()}
          >
            {deletion.isPending ? 'Видаляємо…' : 'Так, видалити'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
