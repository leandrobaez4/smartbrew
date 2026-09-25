import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';

export class LockUnavailableError extends Error {
  constructor(readonly resource: string) {
    super(`No se pudo adquirir el lock para ${resource}.`);
    this.name = 'LockUnavailableError';
  }
}

export type LockClient = {
  set(key: string, value: string, px: 'PX', ttlMs: number, nx: 'NX'): Promise<'OK' | null>;
  eval(script: string, keys: number, key: string, token: string): Promise<unknown>;
};

let redis: Redis | undefined;

function lockClient() {
  if (!redis) redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  return redis;
}

export function distributedLockKey(resource: string) {
  const digest = createHash('sha256').update(resource).digest('hex');
  return `smartbrew:lock:${digest}`;
}

export async function withDistributedLock<T>(
  resource: string,
  task: () => Promise<T>,
  options: {
    client?: LockClient;
    ttlMs?: number;
    waitMs?: number;
    retryDelayMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
) {
  const client = options.client || lockClient();
  const ttlMs = options.ttlMs ?? 30_000;
  const waitMs = options.waitMs ?? 5_000;
  const retryDelayMs = options.retryDelayMs ?? 100;
  if (!resource.trim() || ttlMs < 1_000 || ttlMs > 300_000 || waitMs < 0 || waitMs > 30_000 || retryDelayMs < 10) {
    throw new Error('Configuración de lock inválida.');
  }
  const key = distributedLockKey(resource);
  const token = randomUUID();
  const deadline = Date.now() + waitMs;
  const sleep = options.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  while (await client.set(key, token, 'PX', ttlMs, 'NX') !== 'OK') {
    if (Date.now() >= deadline) throw new LockUnavailableError(resource);
    await sleep(Math.min(retryDelayMs, Math.max(0, deadline - Date.now())));
  }
  try {
    return await task();
  } finally {
    try {
      await client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        key,
        token,
      );
    } catch (error) {
      console.error('Failed to release distributed lock; it will expire by TTL.', error instanceof Error ? error.message : 'Unknown error');
    }
  }
}
