import type { Order, OrderItem } from '@prisma/client';
import { deliveryLabels } from '@tovarka/shared';
import { env } from '../config/env.js';
export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const money = (value: { toString(): string }) =>
  new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(
    Number(value.toString()),
  );
export function formatOrderMessage(order: Order & { items: OrderItem[] }) {
  return [
    'Нове замовлення',
    order.orderNumber,
    `Покупець: ${order.customerName}`,
    `Телефон: ${order.phone}`,
    ...(order.email ? [`Пошта: ${order.email}`] : []),
    '',
    ...order.items.map(
      (i) =>
        `${i.productName} — ${i.quantity} × ${money(i.unitPrice)} = ${money(i.lineTotal)}`,
    ),
    '',
    `Разом: ${money(order.total)}`,
    `Доставка: ${deliveryLabels[order.deliveryMethod as keyof typeof deliveryLabels] ?? order.deliveryMethod}`,
    ...(order.deliveryAddress ? [`Адреса: ${order.deliveryAddress}`] : []),
    ...(order.comment ? [`Коментар: ${order.comment}`] : []),
    `Дата: ${order.createdAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`,
  ].join('\n');
}
export function splitTelegramMessage(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const character of text) {
    if (current.length + character.length > 3400) {
      chunks.push(escapeHtml(current));
      current = '';
    }
    current += character;
  }
  if (current) chunks.push(escapeHtml(current));
  return chunks;
}
export type DeliveryOutcome = {
  status: 'SENT' | 'RETRY' | 'FAILED' | 'UNKNOWN';
  delay?: number;
};
export async function sendTelegramMessage(
  text: string,
): Promise<DeliveryOutcome> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const body: unknown = await response.json();
    if (
      response.ok &&
      typeof body === 'object' &&
      body !== null &&
      'ok' in body &&
      body.ok === true
    )
      return { status: 'SENT' };
    if (response.status === 429) return { status: 'RETRY', delay: 300000 };
    return { status: response.status >= 500 ? 'UNKNOWN' : 'FAILED' };
  } catch {
    // A timeout can occur after Telegram accepts a message. Do not resend automatically.
    return { status: 'UNKNOWN' };
  }
}
