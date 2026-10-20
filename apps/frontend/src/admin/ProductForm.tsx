import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, LoaderCircle } from 'lucide-react';
import {
  createProductSchema,
  createCategorySchema,
  type CreateProductForm,
  type CreateProductInput,
} from '@tovarka/shared';
import { ProductPhotos } from './ProductPhotos';
import { adminApi } from './api';
import { productApi } from '../services/api';
import { Button, Input, ErrorState } from '../components/ui';
import { getErrorMessage } from '../utils/format';
export function ProductForm() {
  const client = useQueryClient();
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const form = useForm<CreateProductForm, unknown, CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: '',
      description: '',
      price: '',
      stock: 0,
      categoryId: '',
      imageUrl: '',
      imageUrls: [],
      active: true,
    },
  });
  const categoryId = useWatch({ control: form.control, name: 'categoryId' });
  const imageUrls =
    useWatch({ control: form.control, name: 'imageUrls' }) ?? [];
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: productApi.categories,
  });
  const create = useMutation({
    mutationFn: adminApi.createProduct,
    onSuccess: (product) => {
      setNotice(
        `Товар «${product.name}» додано${product.active ? ' до каталогу' : ' як прихований'}.`,
      );
      form.reset();
      void client.invalidateQueries({ queryKey: ['products'] });
      void client.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void client.invalidateQueries({ queryKey: ['admin', 'products'] });
      void client.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
  });
  const category = useMutation({
    mutationFn: adminApi.createCategory,
    onSuccess: (result) => {
      setCategoryName('');
      setCategoryError('');
      void client.invalidateQueries({ queryKey: ['categories'] });
      void client.invalidateQueries({ queryKey: ['admin', 'categories'] });
      form.setValue('categoryId', result.id, { shouldValidate: true });
    },
  });
  const addCategory = () => {
    const result = createCategorySchema.safeParse({ name: categoryName });
    if (!result.success) {
      setCategoryError(result.error.issues[0]?.message ?? 'Перевірте назву');
      return;
    }
    category.mutate(result.data.name);
  };
  const errors = form.formState.errors;
  const busy = create.isPending || photoBusy || category.isPending;
  return (
    <section className="admin-card admin-product-card">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">ПОПОВНЮЙТЕ СВОЮ КОЛЕКЦІЮ</p>
          <h2>Додати товар</h2>
        </div>
      </div>
      {notice && (
        <div className="admin-success" role="status">
          <Check size={18} />
          {notice}
          <a href="/">Відкрити магазин</a>
        </div>
      )}
      <form
        className="admin-product-form"
        noValidate
        onSubmit={form.handleSubmit((input) => {
          setNotice('');
          create.mutate(input);
        })}
      >
        <fieldset disabled={busy}>
          <div className="admin-product-layout">
            <div>
              <Input
                label="Назва товару"
                placeholder="Наприклад, Горнятко «Теплий ранок»"
                required
                maxLength={120}
                {...form.register('name')}
                error={errors.name?.message}
              />
              <div className="field">
                <label htmlFor="admin-description">Опис товару</label>
                <textarea
                  id="admin-description"
                  rows={5}
                  maxLength={2000}
                  placeholder="Розкажіть про матеріал, розміри та особливості"
                  {...form.register('description')}
                  aria-invalid={!!errors.description}
                  aria-describedby={
                    errors.description ? 'description-error' : undefined
                  }
                />
                {errors.description && (
                  <p id="description-error" className="field-error">
                    {errors.description.message}
                  </p>
                )}
              </div>
              <div className="form-row">
                <Input
                  label="Ціна, грн"
                  inputMode="decimal"
                  placeholder="480.00"
                  required
                  {...form.register('price', {
                    setValueAs: (value: string) => value.replace(',', '.'),
                  })}
                  error={errors.price?.message}
                />
                <Input
                  label="Кількість на складі"
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  required
                  {...form.register('stock', { valueAsNumber: true })}
                  error={errors.stock?.message}
                />
              </div>
              <div className="field">
                <label htmlFor="admin-category">Категорія</label>
                <select
                  id="admin-category"
                  {...form.register('categoryId')}
                  value={categoryId ?? ''}
                  aria-invalid={!!errors.categoryId}
                >
                  <option value="">
                    {categories.isPending
                      ? 'Завантажуємо категорії…'
                      : 'Оберіть категорію'}
                  </option>
                  {categories.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p className="field-error">{errors.categoryId.message}</p>
                )}
              </div>
              {categories.isError && (
                <ErrorState
                  message="Не вдалося завантажити категорії"
                  retry={() => void categories.refetch()}
                />
              )}
              <details className="admin-new-category">
                <summary>Створити нову категорію</summary>
                <div className="admin-category-create">
                  <Input
                    label="Назва нової категорії"
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    maxLength={80}
                    error={categoryError}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={addCategory}
                  >
                    <Plus size={16} /> Додати категорію
                  </Button>
                </div>
                {category.isError && (
                  <p className="form-error" role="alert">
                    {getErrorMessage(category.error)}
                  </p>
                )}
              </details>
              <label className="admin-checkbox">
                <input type="checkbox" {...form.register('active')} />{' '}
                Показувати товар у магазині
              </label>
            </div>
            <ProductPhotos
              value={imageUrls}
              onChange={(photos) => {
                form.setValue('imageUrls', photos, { shouldValidate: true });
                form.setValue('imageUrl', photos[0] ?? '', {
                  shouldValidate: true,
                });
              }}
              onBusyChange={setPhotoBusy}
              disabled={busy}
              error={errors.imageUrls?.message ?? errors.imageUrl?.message}
            />
          </div>
        </fieldset>
        {create.isError && (
          <p className="form-error" role="alert">
            {getErrorMessage(create.error)}
          </p>
        )}
        <div className="admin-product-submit">
          <p>Залишок 0 означає «Немає в наявності».</p>
          <Button type="submit" disabled={busy}>
            {create.isPending ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}{' '}
            {create.isPending ? 'Зберігаємо…' : 'Зберегти товар'}
          </Button>
        </div>
      </form>
    </section>
  );
}
