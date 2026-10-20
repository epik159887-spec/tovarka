import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  escapeHtml,
  splitTelegramMessage,
  sendTelegramMessage,
} from '../apps/backend/src/services/telegram.service.js';
afterEach(() => vi.unstubAllGlobals());
describe('Telegram transport', () => {
  it('splits long Unicode messages before escaping entities', () => {
    const parts = splitTelegramMessage('<'.repeat(5000) + '🌿'.repeat(500));
    expect(parts).toHaveLength(2);
    expect(parts.join('').replaceAll('&lt;', '<')).toBe(
      '<'.repeat(5000) + '🌿'.repeat(500),
    );
  });
  it('escapes customer formatting', () =>
    expect(escapeHtml('<b>Олена & "Іван"</b>')).toBe(
      '&lt;b&gt;Олена &amp; &quot;Іван&quot;&lt;/b&gt;',
    ));
  it('accepts only explicit Telegram success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"ok":true}')),
    );
    expect(await sendTelegramMessage('Нове замовлення')).toEqual({
      status: 'SENT',
    });
  });
  it('marks ambiguous network failure without blindly resending', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await sendTelegramMessage('Замовлення')).toEqual({
      status: 'UNKNOWN',
    });
  });
  it('retries explicit rate-limit rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: 429 })),
    );
    expect(await sendTelegramMessage('Замовлення')).toMatchObject({
      status: 'RETRY',
    });
  });
  it('records permission failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"ok":false}', { status: 403 })),
    );
    expect(await sendTelegramMessage('Замовлення')).toEqual({
      status: 'FAILED',
    });
  });
});
