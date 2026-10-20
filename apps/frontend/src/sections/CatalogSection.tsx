import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
  CupSoda,
  Sofa,
  Flame,
  LayoutGrid,
} from 'lucide-react';
import { productApi } from '../services/api';
import { getErrorMessage } from '../utils/format';
import { ProductCard } from '../components/ProductCard';
import { Button, EmptyState, ErrorState, LoadingState } from '../components/ui';
const categoryIcons: Record<string, typeof CupSoda> = {
  ceramics: CupSoda,
  details: Flame,
  textiles: Sofa,
};
export function CatalogSection({
  onAdded,
}: {
  onAdded: (name: string) => void;
}) {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: productApi.categories,
  });
  const products = useQuery({
    queryKey: ['products', category, debouncedSearch, sort, page],
    queryFn: () =>
      productApi.list(
        new URLSearchParams({
          ...(category ? { category } : {}),
          search: debouncedSearch,
          sort,
          page: String(page),
          limit: '6',
        }),
      ),
  });
  const selectCategory = (slug: string) => {
    setCategory(slug);
    setPage(1);
  };
  return (
    <section id="catalog" className="catalog container section-space">
      <div className="section-top">
        <div>
          <p className="eyebrow">ЗНАЙДІТЬ СВІЙ НАСТРІЙ</p>
          <h2>
            Речі, з якими <em>добре.</em>
          </h2>
        </div>
        <p className="section-intro">
          Для повільних ранків, затишних вечорів
          <br />і всього хорошого між ними.
        </p>
      </div>
      <div className="category-grid" aria-label="Категорії товарів">
        <button
          className={`category-card ${category === '' ? 'selected' : ''}`}
          onClick={() => selectCategory('')}
          aria-pressed={category === ''}
        >
          <LayoutGrid />
          <div>
            <h3>Уся колекція</h3>
            <p>Усе, що створює затишок</p>
          </div>
          <ArrowUpRight size={19} />
        </button>
        {categories.data?.map((item) => {
          const Icon = categoryIcons[item.slug] ?? CupSoda;
          return (
            <button
              className={`category-card ${category === item.slug ? 'selected' : ''}`}
              key={item.id}
              onClick={() => selectCategory(item.slug)}
              aria-pressed={category === item.slug}
            >
              <Icon />
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <ArrowUpRight size={19} />
            </button>
          );
        })}
      </div>
      {categories.isError && (
        <p role="alert" className="inline-error">
          Не вдалося завантажити категорії.{' '}
          <button onClick={() => void categories.refetch()}>Повторити</button>
        </p>
      )}
      <div className="catalog-toolbar">
        <div className="catalog-count">
          <SlidersHorizontal size={17} />
          <span>
            Наша добірка <b>{products.data?.total ?? '—'}</b>
          </span>
        </div>
        <div className="catalog-controls">
          <div className="search-field">
            <Search size={17} />
            <label className="sr-only" htmlFor="product-search">
              Пошук товарів
            </label>
            <input
              id="product-search"
              placeholder="Знайти щось особливе…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
            />
            {search && (
              <button aria-label="Очистити пошук" onClick={() => setSearch('')}>
                <X size={16} />
              </button>
            )}
          </div>
          <label className="sr-only" htmlFor="product-sort">
            Сортування товарів
          </label>
          <select
            id="product-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">Спочатку нові</option>
            <option value="price-asc">Від дешевших</option>
            <option value="price-desc">Від дорожчих</option>
            <option value="name">За назвою</option>
          </select>
        </div>
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
          <div className="product-grid">
            {products.data.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdded={onAdded}
              />
            ))}
          </div>
          {products.data.pages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Попередня
              </Button>
              <span>
                {page} / {products.data.pages}
              </span>
              <Button
                variant="secondary"
                disabled={page === products.data.pages}
                onClick={() => setPage(page + 1)}
              >
                Наступна
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState>
          <h3>Поки нічого не знайшли</h3>
          <p>Спробуйте інший запит або перегляньте всю колекцію.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              selectCategory('');
            }}
          >
            Показати всі товари
          </Button>
        </EmptyState>
      )}
    </section>
  );
}
