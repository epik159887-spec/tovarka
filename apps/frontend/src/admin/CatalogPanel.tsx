import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, PackageOpen } from 'lucide-react';
import type { AdminProductPage } from '@tovarka/shared';
import { adminApi } from './api';
import { Button, LoadingState, ErrorState, EmptyState } from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';
import { DeleteCatalogDialog, type CatalogTarget } from './DeleteCatalogDialog';
export function CatalogPanel() {
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<CatalogTarget | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const products = useQuery({
    queryKey: ['admin', 'products', page, query],
    queryFn: () => adminApi.products(page, query),
    retry: false,
  });
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminApi.categories,
    retry: false,
  });
  return (
    <div className="admin-catalog">
      {notice && (
        <p className="admin-success" role="status">
          {notice}
        </p>
      )}
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">КЕРУЙТЕ СВОЄЮ КОЛЕКЦІЄЮ</p>
            <h2>Товари</h2>
          </div>
          <label className="admin-search">
            <Search size={17} />
            <span className="sr-only">Пошук товарів в адмінпанелі</span>
            <input
              placeholder="Назва товару"
              value={search}
              maxLength={100}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {products.isPending ? (
          <LoadingState />
        ) : products.isError ? (
          <ErrorState
            message={getErrorMessage(products.error)}
            retry={() => void products.refetch()}
          />
        ) : products.data.products.length ? (
          <>
            <div className="admin-table-scroll">
              <table className="admin-orders-table admin-products-table">
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>Категорія</th>
                    <th>Залишок</th>
                    <th>Ціна</th>
                    <th>
                      <span className="sr-only">Дії</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.data.products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-summary">
                          <img src={product.imageUrl} alt="" />
                          <div>
                            <strong>{product.name}</strong>
                            <span>
                              {product.active ? 'У магазині' : 'Прихований'} ·{' '}
                              {product.imageUrls?.length || 1} фото
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{product.category.name}</td>
                      <td>{product.stock}</td>
                      <td className="admin-money">
                        {formatCurrency(product.price)}
                      </td>
                      <td>
                        <button
                          className="admin-delete-button"
                          aria-label={`Видалити товар ${product.name}`}
                          onClick={() =>
                            setTarget({
                              kind: 'product',
                              id: product.id,
                              name: product.name,
                            })
                          }
                        >
                          <Trash2 size={16} /> Видалити
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <span>Усього: {products.data.total}</span>
              <div>
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Назад
                </Button>
                <span>
                  {page} / {products.data.pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= products.data.pages}
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
            <h3>{query ? 'Товарів не знайдено' : 'Товарів поки немає'}</h3>
            <p>
              {query
                ? 'Спробуйте іншу назву.'
                : 'Додайте перший товар у вкладці «Додати товар».'}
            </p>
          </EmptyState>
        )}
      </section>
      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <p className="eyebrow">РОЗДІЛИ МАГАЗИНУ</p>
            <h2>Категорії</h2>
            <p className="muted">
              Для видалення категорії спочатку видаліть її товари, зокрема
              приховані.
            </p>
          </div>
        </div>
        {categories.isPending ? (
          <LoadingState />
        ) : categories.isError ? (
          <ErrorState
            message={getErrorMessage(categories.error)}
            retry={() => void categories.refetch()}
          />
        ) : categories.data.length ? (
          <ul className="admin-category-list">
            {categories.data.map((category) => (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <span className="muted">
                    Товарів: {category.productCount}
                  </span>
                </div>
                <button
                  className="admin-delete-button"
                  aria-label={`Видалити категорію ${category.name}`}
                  onClick={() =>
                    setTarget({
                      kind: 'category',
                      id: category.id,
                      name: category.name,
                      productCount: category.productCount,
                    })
                  }
                >
                  <Trash2 size={16} /> Видалити
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            <h3>Категорій поки немає</h3>
            <p>Створіть категорію під час додавання товару.</p>
          </EmptyState>
        )}
      </section>
      {target && (
        <DeleteCatalogDialog
          target={target}
          onClose={() => setTarget(null)}
          onDeleted={() => {
            setNotice(
              `${target.kind === 'product' ? 'Товар' : 'Категорію'} «${target.name}» видалено.`,
            );
            setTarget(null);
            const refreshed = cache.getQueryData<AdminProductPage>([
              'admin',
              'products',
              page,
              query,
            ]);
            if (refreshed && page > Math.max(1, refreshed.pages))
              setPage(Math.max(1, refreshed.pages));
          }}
        />
      )}
    </div>
  );
}
