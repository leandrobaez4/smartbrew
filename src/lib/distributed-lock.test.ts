import { describe, expect, it, vi } from 'vitest';
import { distributedLockKey, LockUnavailableError, withDistributedLock } from './distributed-lock';

describe('distributed lock', () => {
  it('acquires with a TTL and releases only its own token', async () => {
    const client = { set: vi.fn().mockResolvedValue('OK'), eval: vi.fn().mockResolvedValue(1) };
    const task = vi.fn().mockResolvedValue('done');
    await expect(withDistributedLock('supplier-sync:one', task, { client, ttlMs: 10_000 })).resolves.toBe('done');
    expect(client.set).toHaveBeenCalledWith(distributedLockKey('supplier-sync:one'), expect.any(String), 'PX', 10_000, 'NX');
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining('redis.call("get"'), 1, distributedLockKey('supplier-sync:one'), expect.any(String));
  });

  it('releases after task failures', async () => {
    const client = { set: vi.fn().mockResolvedValue('OK'), eval: vi.fn().mockResolvedValue(1) };
    await expect(withDistributedLock('order:one', async () => { throw new Error('failed'); }, { client })).rejects.toThrow('failed');
    expect(client.eval).toHaveBeenCalledOnce();
  });

  it('fails within the configured wait timeout when another worker owns the lock', async () => {
    const client = { set: vi.fn().mockResolvedValue(null), eval: vi.fn() };
    await expect(withDistributedLock('sync:one', async () => undefined, { client, waitMs: 0 })).rejects.toBeInstanceOf(LockUnavailableError);
    expect(client.eval).not.toHaveBeenCalled();
  });

  it('does not turn a successful operation into a failure when release is unavailable', async () => {
    const client = { set: vi.fn().mockResolvedValue('OK'), eval: vi.fn().mockRejectedValue(new Error('redis unavailable')) };
    await expect(withDistributedLock('sync:release', async () => 'done', { client })).resolves.toBe('done');
  });
});
