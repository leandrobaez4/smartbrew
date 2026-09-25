import { IntegrationLogStatus, Prisma } from '@prisma/client';
import { portalDb } from './portal';

const secretKey = /(api.?key|api.?secret|access.?token|refresh.?token|authorization|bearer|password|passwd|credential|private.?key|secret|card.?number|credit.?card|cvv|cvc|security.?code)/i;

function safeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => safeValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    secretKey.test(key) ? '[REDACTED]' : safeValue(item, seen),
  ]));
}

export function sanitizeIntegrationPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(safeValue(value, new WeakSet()))) as Prisma.InputJsonValue;
}

export type IntegrationOperation = {
  provider: string;
  operation: string;
  request?: unknown;
  response?: unknown;
  status: IntegrationLogStatus;
  error?: string;
  durationMs: number;
};

type IntegrationLogStore = Pick<typeof portalDb, 'integrationLog'>;

export async function recordIntegrationOperation(input: IntegrationOperation, store: IntegrationLogStore = portalDb) {
  return store.integrationLog.create({
    data: {
      provider: input.provider,
      operation: input.operation,
      request: input.request == null ? Prisma.JsonNull : sanitizeIntegrationPayload(input.request),
      response: input.response == null ? Prisma.JsonNull : sanitizeIntegrationPayload(input.response),
      status: input.status,
      error: input.error || null,
      durationMs: Math.max(0, Math.round(input.durationMs)),
    },
  });
}

export async function findIntegrationLogs(
  filters: { provider?: string; operation?: string; take?: number } = {},
  store: IntegrationLogStore = portalDb,
) {
  return store.integrationLog.findMany({
    where: {
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.operation ? { operation: filters.operation } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, Math.max(1, filters.take ?? 100)),
  });
}
