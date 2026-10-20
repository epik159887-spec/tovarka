import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, LockKeyhole, LoaderCircle } from 'lucide-react';
import {
  customerSchema,
  deliveryLabels,
  type CustomerForm,
  type CustomerInput,
  type OrderResult,
} from '@tovarka/shared';
import { useCart } from '../hooks/useCart';
import { orderApi } from '../services/api';
import { clearOrderKey, getPersistentOrderKey } from '../utils/idempotency';
import { formatCurrency, getErrorMessage } from '../utils/format';
import { Button, Input, Modal } from './ui';
export function CheckoutForm({
  onClose,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
}) {
  const { items, total, clear } = useCart();
  const client = useQueryClient();
  const [success, setSuccess] = useState<OrderResult | null>(null);
  const form = useForm<CustomerForm, unknown, CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      deliveryMethod: 'post',
      deliveryAddress: '',
      comment: '',
    },
  });
  const method = useWatch({ control: form.control, name: 'deliveryMethod' });
  const mutation = useMutation({
    mutationFn: async (customer: CustomerInput) => {
      const input = {
        customer,
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      };
      return orderApi.create(input, await getPersistentOrderKey(input));
    },
    onSuccess: (result) => {
      setSuccess(result);
      clear();
      clearOrderKey();
      void client.invalidateQueries({ queryKey: ['products'] });
    },
  });
  if (success)
    return (
      <Modal title="Дякуємо за замовлення!" onClose={onClose}>
        <div className="order-success">
          <span className="success-check">
            <Check size={32} />
          </span>
          <h3>Ваші затишні речі вже на крок ближче</h3>
          <p>
            Замовлення збережено. Ми зв’яжемося з вами для підтвердження
            деталей.
          </p>
          <div className="success-number">
            <span>Номер замовлення</span>
            <strong>{success.orderNumber}</strong>
            <span>Товари: {formatCurrency(success.total)}</span>
          </div>
          <p className="muted">
            Оплату й доставку узгодимо під час підтвердження. Зараз нічого
            сплачувати не потрібно.
          </p>
          <Button onClick={onClose}>Повернутися до колекції</Button>
        </div>
      </Modal>
    );
  const errors = form.formState.errors;
  return (
    <Modal
      title="Оформлення замовлення"
      onClose={onClose}
      busy={mutation.isPending}
    >
      <form
        className="checkout-form"
        onSubmit={form.handleSubmit((customer) => mutation.mutate(customer))}
        noValidate
      >
        <button
          className="text-button back-button"
          type="button"
          disabled={mutation.isPending}
          onClick={onBack}
        >
          <ArrowLeft size={16} /> До кошика
        </button>
        <fieldset disabled={mutation.isPending}>
          <legend>Ваші контакти</legend>
          <Input
            label="Ім’я та прізвище"
            autoComplete="name"
            placeholder="Як до вас звертатися?"
            required
            maxLength={100}
            {...form.register('customerName')}
            error={errors.customerName?.message}
          />
          <div className="form-row">
            <Input
              label="Номер телефону"
              type="tel"
              autoComplete="tel"
              placeholder="+380 00 000 00 00"
              required
              maxLength={30}
              {...form.register('phone')}
              error={errors.phone?.message}
            />
            <Input
              label="Електронна пошта (необов’язково)"
              type="email"
              autoComplete="email"
              placeholder="Ваша електронна адреса"
              maxLength={254}
              {...form.register('email')}
              error={errors.email?.message}
            />
          </div>
        </fieldset>
        <fieldset disabled={mutation.isPending}>
          <legend>Доставка</legend>
          <div className="field">
            <label htmlFor="delivery-method">Спосіб отримання</label>
            <select id="delivery-method" {...form.register('deliveryMethod')}>
              {Object.entries(deliveryLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {method !== 'pickup' && (
            <Input
              label={
                method === 'post'
                  ? 'Місто й відділення Нової пошти'
                  : 'Місто та повна адреса'
              }
              autoComplete="street-address"
              placeholder={
                method === 'post'
                  ? 'Місто, номер відділення або поштомата'
                  : 'Місто, вулиця, будинок, квартира'
              }
              required
              maxLength={300}
              {...form.register('deliveryAddress')}
              error={errors.deliveryAddress?.message}
            />
          )}
          <div className="field">
            <label htmlFor="comment">Коментар (необов’язково)</label>
            <textarea
              id="comment"
              rows={3}
              maxLength={1000}
              placeholder="Ваші побажання чи запитання"
              {...form.register('comment')}
              aria-invalid={!!errors.comment}
            />
            {errors.comment && (
              <p className="field-error">{errors.comment.message}</p>
            )}
          </div>
        </fieldset>
        <div className="checkout-total">
          <span>Товари ({items.reduce((n, i) => n + i.quantity, 0)})</span>
          <strong>{formatCurrency(total / 100)}</strong>
        </div>
        <p className="muted">
          Доставка оплачується окремо за тарифами перевізника. Спосіб оплати та
          самовивіз узгодимо після замовлення. Ціни й наявність перевіряються
          сервером.
        </p>
        {mutation.isError && (
          <div className="form-error" role="alert">
            <p>{getErrorMessage(mutation.error)}</p>
            <p>
              Якщо з’єднання перервалося, повторіть запит без зміни даних —
              друге замовлення не створиться.
            </p>
          </div>
        )}
        <Button type="submit" disabled={mutation.isPending || !items.length}>
          {mutation.isPending ? (
            <>
              <LoaderCircle size={18} className="animate-spin" /> Зберігаємо…
            </>
          ) : (
            'Підтвердити замовлення'
          )}
        </Button>
        <p className="privacy-note">
          <LockKeyhole size={13} /> Контакти використовуємо лише для обробки
          замовлення.
        </p>
      </form>
    </Modal>
  );
}
