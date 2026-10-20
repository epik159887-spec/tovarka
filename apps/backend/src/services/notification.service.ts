import { env } from '../config/env.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import {
  formatOrderMessage,
  splitTelegramMessage,
  sendTelegramMessage,
} from './telegram.service.js';
let running = false;
export async function processNotification() {
  if (running || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  running = true;
  try {
    const job = await notificationRepository.claim();
    if (job) {
      const parts = splitTelegramMessage(formatOrderMessage(job.order));
      const part = parts[job.nextPart];
      if (part === undefined) throw new Error('Invalid notification progress');
      const outcome = await sendTelegramMessage(part);
      await notificationRepository.finish(
        job.id,
        job.attempts,
        outcome,
        job.nextPart + 1 < parts.length,
      );
      if (outcome.status !== 'SENT')
        console.warn('Telegram notification requires attention', {
          notificationId: job.id,
          status: outcome.status,
        });
    }
  } finally {
    running = false;
  }
}
export function startNotificationWorker() {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID)
    console.warn('Telegram is not configured; notifications remain queued.');
  const timer = setInterval(() => {
    void processNotification().catch(() =>
      console.error('Notification worker failed'),
    );
  }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
