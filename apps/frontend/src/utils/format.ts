export function formatCurrency(value: number | string) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 2,
  }).format(Number(value));
}
export function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Сталася помилка. Спробуйте ще раз.';
}
