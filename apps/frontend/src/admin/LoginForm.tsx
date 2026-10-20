import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, ArrowLeft, LoaderCircle } from 'lucide-react';
import {
  adminLoginSchema,
  type AdminLogin,
  type AdminIdentity,
} from '@tovarka/shared';
import { adminApi } from './api';
import { getErrorMessage } from '../utils/format';
import { Button, Input } from '../components/ui';
export function LoginForm({
  onSuccess,
}: {
  onSuccess: (identity: AdminIdentity) => void;
}) {
  const form = useForm<AdminLogin>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { username: '', password: '' },
  });
  const login = useMutation({ mutationFn: adminApi.login, onSuccess });
  return (
    <main className="admin-login">
      <a className="admin-back" href="/">
        <ArrowLeft size={16} /> До магазину
      </a>
      <div className="admin-login-card">
        <span className="admin-lock">
          <ShieldCheck size={30} />
        </span>
        <p className="eyebrow">ТОВАРКА · КЕРУВАННЯ МАГАЗИНОМ</p>
        <h1>
          Раді бачити <em>вас.</em>
        </h1>
        <p className="admin-subtitle">
          Увійдіть, щоб переглядати замовлення та додавати товари.
        </p>
        <form
          onSubmit={form.handleSubmit((input) => login.mutate(input))}
          noValidate
        >
          <fieldset disabled={login.isPending}>
            <Input
              label="Логін"
              autoComplete="username"
              required
              maxLength={80}
              {...form.register('username')}
              error={form.formState.errors.username?.message}
            />
            <Input
              label="Пароль"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
          </fieldset>
          {login.isError && (
            <p className="form-error" role="alert">
              {getErrorMessage(login.error)}
            </p>
          )}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? (
              <>
                <LoaderCircle size={16} className="animate-spin" /> Входимо…
              </>
            ) : (
              'Увійти до панелі'
            )}
          </Button>
        </form>
        <p className="admin-login-note">
          Доступ лише для адміністратора магазину.
        </p>
      </div>
    </main>
  );
}
