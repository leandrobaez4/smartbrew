import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ parse: vi.fn(), process: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/mercado-libre-orders', () => ({
  parseMercadoLibreNotification: mocks.parse,
  processMercadoLibreNotification: mocks.process,
}));
vi.mock('@/lib/logger', () => ({ logSystemEvent: mocks.log }));

import { POST } from './route';

const body = {
  _id: 'event-123', topic: 'orders_v2', resource: '/orders/123', user_id: 1,
  application_id: 2, attempts: 1, sent: '2026-09-24T20:00:00Z',
};

describe('POST /api/webhooks/mercadolibre', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.parse.mockImplementation((value) => {
      const input = value as typeof body;
      if (!input.topic || !input.resource || input.user_id == null || input.application_id == null) throw new Error('invalid');
      return input;
    });
  });

  it('acknowledges a valid idempotent event', async () => {
    mocks.process.mockResolvedValue({ status: 'processed' });
    const response = await POST(new Request('http://localhost/api/webhooks/mercadolibre', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, status: 'processed' });
  });

  it('rejects malformed and oversized payloads', async () => {
    const malformed = await POST(new Request('http://localhost/api/webhooks/mercadolibre', { method: 'POST', body: '{}' }));
    expect(malformed.status).toBe(400);
    const oversized = await POST(new Request('http://localhost/api/webhooks/mercadolibre', { method: 'POST', body: 'x'.repeat(65 * 1024) }));
    expect(oversized.status).toBe(413);
  });

  it('returns a retryable response and logs processing failures', async () => {
    mocks.process.mockRejectedValue(new Error('provider unavailable'));
    const response = await POST(new Request('http://localhost/api/webhooks/mercadolibre', {
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(response.status).toBe(503);
    expect(mocks.log).toHaveBeenCalledWith('ERROR', 'mercado_libre_webhook', expect.any(String), expect.objectContaining({
      topic: 'orders_v2', resource: '/orders/123', error: 'provider unavailable',
    }));
  });
});
