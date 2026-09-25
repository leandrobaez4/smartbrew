import { IntegrationLogStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { findIntegrationLogs, recordIntegrationOperation, sanitizeIntegrationPayload } from './integration-logs';

describe('integration logs', () => {
  it('redacts secrets recursively, including card information', () => {
    const safe = sanitizeIntegrationPayload({
      apiKey: 'key',
      nested: { access_token: 'token', password: 'password', normal: 'visible' },
      payment: { cardNumber: '4111111111111111', cvv: '123' },
    });
    expect(safe).toEqual({
      apiKey: '[REDACTED]',
      nested: { access_token: '[REDACTED]', password: '[REDACTED]', normal: 'visible' },
      payment: { cardNumber: '[REDACTED]', cvv: '[REDACTED]' },
    });
    expect(JSON.stringify(safe)).not.toContain('4111111111111111');
  });

  it('persists sanitized operation metadata', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'log-1' });
    await recordIntegrationOperation({
      provider: 'supplier-one',
      operation: 'getPrice',
      request: { externalId: 'p-1', apiSecret: 'secret' },
      response: { amount: 100 },
      status: IntegrationLogStatus.SUCCESS,
      durationMs: 12.4,
    }, { integrationLog: { create } } as never);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      provider: 'supplier-one',
      operation: 'getPrice',
      request: { externalId: 'p-1', apiSecret: '[REDACTED]' },
      status: IntegrationLogStatus.SUCCESS,
      durationMs: 12,
    }) });
  });

  it('filters by provider and operation', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await findIntegrationLogs({ provider: 'supplier-one', operation: 'createOrder' }, { integrationLog: { findMany } } as never);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider: 'supplier-one', operation: 'createOrder' },
    }));
  });
});
