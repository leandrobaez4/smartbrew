import type { Job, JobsOptions } from 'bullmq';
import { Client, type CreateScheduleRequest } from '@upstash/qstash';
import { JobStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { portalDb } from './portal';
import { withDistributedLock } from './distributed-lock';
import { getDropshippingSettings } from './dropshipping-settings';
import { createSupplierOrder } from './supplier-order-service';
import { publishSupplierProduct, PublishSupplierProductInput } from './supplier-marketplace-publication';
import { syncMarketplaceFees } from './mercado-libre-fees';
import { syncMarketplacePrices } from './supplier-price-sync';
import { syncMarketplaceStock } from './supplier-stock-sync';
import { syncSupplierOrderStatuses } from './supplier-order-status-sync';
import { monitorPublishedSupplierProducts } from './suppliers/monitor';
import { syncSuppliers } from './suppliers/sync';

export const DropshippingJobName = {
  SupplierCatalogSyncJob: 'SupplierCatalogSyncJob',
  SupplierStockSyncJob: 'SupplierStockSyncJob',
  SupplierPriceSyncJob: 'SupplierPriceSyncJob',
  MarketplaceStockSyncJob: 'MarketplaceStockSyncJob',
  MarketplacePriceSyncJob: 'MarketplacePriceSyncJob',
  MarketplaceFeeSyncJob: 'MarketplaceFeeSyncJob',
  SupplierOrderJob: 'SupplierOrderJob',
  SupplierOrderStatusSyncJob: 'SupplierOrderStatusSyncJob',
  MarketplacePublishJob: 'MarketplacePublishJob',
} as const;

export type DropshippingJobName = typeof DropshippingJobName[keyof typeof DropshippingJobName];

const syncJob = z.object({ supplierId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional(), executionId: z.string().optional() }).strict();
const orderJob = z.object({ orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/), executionId: z.string().optional() }).strict();
const publishJob = z.object({
  supplierProductId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  marketplaceAccountId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  marketplaceFee: z.number().finite().nonnegative(),
  shippingCost: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  extraCosts: z.number().finite().nonnegative(),
  targetMarginPercentage: z.number().finite().min(0).lt(100),
  automatic: z.boolean().optional(),
  executionId: z.string().optional(),
}).strict();

type JobData = Record<string, unknown> & { executionId?: string };
type JobStore = Pick<typeof portalDb, 'jobExecution'>;
type QStashPublisher = Pick<Client, 'publishJSON'>;
type QStashScheduleClient = {
  list(): Promise<Array<{ scheduleId: string; destination: string; cron: string; labels?: string[] }>>;
  create(request: CreateScheduleRequest): Promise<{ scheduleId: string }>;
  delete(scheduleId: string): Promise<void>;
};

const scheduleLabel = 'smartbrew-dropshipping-sync';
const scheduleJobName = 'DropshippingScheduleDispatch';

function qstashConfig() {
  const token = process.env.QSTASH_TOKEN;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const appUrl = process.env.APP_URL;
  if (!token || !currentSigningKey || !nextSigningKey || !appUrl) {
    throw new Error('Configurá QStash, sus dos claves de firma y APP_URL.');
  }
  const destination = new URL('/api/queue/dropshipping', appUrl);
  if (destination.protocol !== 'https:') throw new Error('APP_URL debe usar HTTPS.');
  return { token, destination: destination.href };
}

function qstashHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : {}),
  };
}

export function optionsForDropshippingJob(name: DropshippingJobName): JobsOptions {
  const externalSideEffect = name === DropshippingJobName.SupplierOrderJob || name === DropshippingJobName.MarketplacePublishJob;
  return {
    attempts: externalSideEffect ? 1 : 4,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1_000 },
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jobEntity(name: DropshippingJobName, data: Record<string, unknown>) {
  if (name === DropshippingJobName.MarketplacePublishJob && typeof data.supplierProductId === 'string') {
    return { entityType: 'SupplierProduct', entityId: data.supplierProductId };
  }
  if (name === DropshippingJobName.SupplierOrderJob && typeof data.orderId === 'string') {
    return { entityType: 'Order', entityId: data.orderId };
  }
  return {};
}

export async function enqueueDropshippingJob(
  name: DropshippingJobName,
  data: Record<string, unknown>,
  dependencies: { publisher?: QStashPublisher; store?: JobStore } = {},
) {
  const config = qstashConfig();
  const publisher = dependencies.publisher || new Client({ token: config.token });
  const store = dependencies.store || portalDb;
  const options = optionsForDropshippingJob(name);
  const maxAttempts = Number(options.attempts || 1);
  const execution = await store.jobExecution.create({
    data: { jobName: name, status: JobStatus.STARTED, inputJson: json(data), maxAttempts, ...jobEntity(name, data) },
  });
  try {
    await publisher.publishJSON({
      url: config.destination,
      body: { jobId: execution.id },
      deduplicationId: execution.id,
      retries: Math.max(0, maxAttempts - 1),
      timeout: '90s',
      flowControl: {
        key: name === DropshippingJobName.MarketplacePublishJob
          ? 'smartbrew-dropshipping-publish'
          : 'smartbrew-dropshipping-sync',
        parallelism: 1,
      },
      headers: qstashHeaders(),
    });
    return { status: 'queued' as const, jobId: execution.id };
  } catch (error) {
    await store.jobExecution.update({
      where: { id: execution.id },
      data: { status: JobStatus.FAILED, errorMessage: 'No se pudo encolar el trabajo.', finishedAt: new Date() },
    });
    throw new Error('No se pudo confirmar el envío del trabajo a QStash.', { cause: error });
  }
}

function jobInput(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function processDropshippingQStashJob(
  jobId: string,
  dependencies: Parameters<typeof executeDropshippingJob>[1] & { store?: JobStore } = {},
) {
  const store = dependencies.store || portalDb;
  const execution = await store.jobExecution.findUnique({ where: { id: jobId } });
  if (!execution || !Object.values(DropshippingJobName).includes(execution.jobName as DropshippingJobName)) {
    throw new Error('Trabajo de dropshipping inválido.');
  }
  if (execution.status !== JobStatus.STARTED) return { status: 'duplicate' as const };
  return executeDropshippingJob({
    id: execution.id,
    name: execution.jobName,
    data: { ...jobInput(execution.inputJson), executionId: execution.id },
    attemptsMade: execution.attemptCount,
    opts: { attempts: execution.maxAttempts },
  }, dependencies);
}

export async function ensureDropshippingQStashSchedule(scheduleClient?: QStashScheduleClient) {
  const config = qstashConfig();
  const schedules = scheduleClient || new Client({ token: config.token }).schedules;
  const existing = (await schedules.list()).filter((schedule) => schedule.labels?.includes(scheduleLabel));
  const request = {
    destination: config.destination,
    body: JSON.stringify({ schedule: 'dropshipping' }),
    headers: qstashHeaders(),
    cron: '* * * * *',
    retries: 2,
    timeout: 90,
    flowControl: { key: 'smartbrew-dropshipping-schedule', parallelism: 1 },
    label: scheduleLabel,
  };
  const primary = existing[0];
  const result = await schedules.create(primary ? { ...request, scheduleId: primary.scheduleId } : request);
  await Promise.all(existing.slice(1).map((schedule) => schedules.delete(schedule.scheduleId)));
  return { scheduleId: result.scheduleId, repaired: Boolean(primary), removedDuplicates: Math.max(0, existing.length - 1) };
}

export async function dispatchScheduledDropshippingJobs(dependencies: {
  store?: JobStore;
  publisher?: QStashPublisher;
  getSettings?: typeof getDropshippingSettings;
  now?: () => Date;
} = {}) {
  const store = dependencies.store || portalDb;
  const now = (dependencies.now || (() => new Date()))();
  const settings = await (dependencies.getSettings || getDropshippingSettings)();
  const latest = await store.jobExecution.findFirst({
    where: { jobName: scheduleJobName, status: { in: [JobStatus.STARTED, JobStatus.SUCCEEDED] } },
    orderBy: { startedAt: 'desc' },
  });
  if (latest && now.getTime() - latest.startedAt.getTime() < settings.supplierSyncInterval * 60_000) {
    return { status: 'not_due' as const, nextAfter: new Date(latest.startedAt.getTime() + settings.supplierSyncInterval * 60_000) };
  }
  const dispatch = await store.jobExecution.create({
    data: { jobName: scheduleJobName, status: JobStatus.STARTED, inputJson: { intervalMinutes: settings.supplierSyncInterval } },
  });
  const jobs = [
    DropshippingJobName.SupplierStockSyncJob,
    DropshippingJobName.MarketplaceStockSyncJob,
    DropshippingJobName.MarketplacePriceSyncJob,
  ];
  try {
    const queued = [];
    for (const name of jobs) {
      queued.push(await enqueueDropshippingJob(name, {}, { store, publisher: dependencies.publisher }));
    }
    await store.jobExecution.update({
      where: { id: dispatch.id },
      data: { status: JobStatus.SUCCEEDED, outputJson: { jobs: queued.map((job) => job.jobId) }, finishedAt: now },
    });
    return { status: 'queued' as const, jobs: queued.map((job) => job.jobId) };
  } catch (error) {
    await store.jobExecution.update({
      where: { id: dispatch.id },
      data: { status: JobStatus.FAILED, errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'No se pudo programar la sincronización.', finishedAt: now },
    });
    throw error;
  }
}

type JobHandlers = {
  syncSuppliers: typeof syncSuppliers;
  monitorPublishedSupplierProducts: typeof monitorPublishedSupplierProducts;
  syncMarketplaceStock: typeof syncMarketplaceStock;
  syncMarketplacePrices: typeof syncMarketplacePrices;
  syncMarketplaceFees: typeof syncMarketplaceFees;
  syncSupplierOrderStatuses: typeof syncSupplierOrderStatuses;
  createSupplierOrder: typeof createSupplierOrder;
  publishSupplierProduct: typeof publishSupplierProduct;
};

const defaultHandlers: JobHandlers = {
  syncSuppliers,
  monitorPublishedSupplierProducts,
  syncMarketplaceStock,
  syncMarketplacePrices,
  syncMarketplaceFees,
  syncSupplierOrderStatuses,
  createSupplierOrder,
  publishSupplierProduct,
};

export function dropshippingJobLockKey(name: DropshippingJobName, data: JobData) {
  if (name === DropshippingJobName.SupplierOrderJob) return `supplier-order:${String(data.orderId || '')}`;
  if (name === DropshippingJobName.MarketplacePublishJob) {
    return `marketplace-publish:${String(data.supplierProductId || '')}:${String(data.marketplaceAccountId || '')}`;
  }
  if (name === DropshippingJobName.SupplierCatalogSyncJob || name === DropshippingJobName.SupplierStockSyncJob || name === DropshippingJobName.SupplierPriceSyncJob) {
    return `${name}:${String(data.supplierId || 'all')}`;
  }
  return name;
}

export async function executeDropshippingJob(
  job: Pick<Job<JobData>, 'id' | 'name' | 'data' | 'attemptsMade' | 'opts'>,
  dependencies: {
    handlers?: JobHandlers;
    store?: JobStore;
    withLock?: typeof withDistributedLock;
    getSettings?: typeof getDropshippingSettings;
  } = {},
) {
  const handlers = dependencies.handlers || defaultHandlers;
  const store = dependencies.store || portalDb;
  let executionId = job.data.executionId;
  const attemptCount = job.attemptsMade + 1;
  if (!executionId) {
    if (!job.id) throw new Error('El trabajo programado no tiene identificador.');
    executionId = String(job.id);
    const maxAttempts = Number(job.opts.attempts || 1);
    await store.jobExecution.upsert({
      where: { id: executionId },
      create: {
        id: executionId,
        jobName: job.name,
        status: JobStatus.STARTED,
        inputJson: json(job.data),
        maxAttempts,
      },
      update: { maxAttempts },
    });
  }
  try {
    const name = job.name as DropshippingJobName;
    const runWithLock = dependencies.withLock || withDistributedLock;
    const output = await runWithLock(dropshippingJobLockKey(name, job.data), async () => {
      switch (name) {
      case DropshippingJobName.SupplierCatalogSyncJob: {
        const data = syncJob.parse(job.data);
        return handlers.syncSuppliers({ supplierId: data.supplierId });
      }
      case DropshippingJobName.SupplierStockSyncJob:
      case DropshippingJobName.SupplierPriceSyncJob: {
        const data = syncJob.parse(job.data);
        return handlers.monitorPublishedSupplierProducts({ supplierId: data.supplierId });
      }
      case DropshippingJobName.MarketplaceStockSyncJob:
      {
        const settings = await (dependencies.getSettings || getDropshippingSettings)();
        return handlers.syncMarketplaceStock({
          minimumStock: settings.minimumStock,
          minimumProfitPercentage: settings.minimumMargin,
          minimumProfitAmount: settings.minimumProfit,
          pauseWhenNoStock: settings.autoPauseNoStock,
        });
      }
      case DropshippingJobName.MarketplacePriceSyncJob:
      {
        const settings = await (dependencies.getSettings || getDropshippingSettings)();
        if (!settings.autoUpdatePrices) return { status: 'disabled' as const };
        return handlers.syncMarketplacePrices({
          minimumProfitPercentage: settings.minimumMargin,
          minimumProfitAmount: settings.minimumProfit,
          maximumPriceChangePercentage: settings.priceChangeLimit,
        });
      }
      case DropshippingJobName.MarketplaceFeeSyncJob:
        return handlers.syncMarketplaceFees();
      case DropshippingJobName.SupplierOrderStatusSyncJob:
        return handlers.syncSupplierOrderStatuses();
      case DropshippingJobName.SupplierOrderJob: {
        const data = orderJob.parse(job.data);
        return handlers.createSupplierOrder(data.orderId, { automatic: true });
      }
      case DropshippingJobName.MarketplacePublishJob: {
        const settings = await (dependencies.getSettings || getDropshippingSettings)();
        const data = publishJob.parse(job.data);
        if (data.automatic && !settings.autoPublish) return { status: 'disabled' as const };
        const publication: PublishSupplierProductInput = {
          supplierProductId: data.supplierProductId,
          marketplaceAccountId: data.marketplaceAccountId,
          marketplaceFee: data.marketplaceFee,
          shippingCost: data.shippingCost,
          taxes: data.taxes,
          extraCosts: data.extraCosts,
          targetMarginPercentage: data.targetMarginPercentage,
        };
        return handlers.publishSupplierProduct(publication, {
          minimumMarginPercentage: settings.minimumMargin,
          minimumProfitAmount: settings.minimumProfit,
        });
      }
      default:
        throw new Error(`Trabajo de dropshipping desconocido: ${job.name}`);
      }
    }, { ttlMs: 300_000, waitMs: 5_000 });
    if (executionId) await store.jobExecution.update({
      where: { id: executionId },
      data: { status: JobStatus.SUCCEEDED, attemptCount, outputJson: json(output), errorMessage: null, finishedAt: new Date() },
    });
    return output;
  } catch (error) {
    const maxAttempts = Number(job.opts.attempts || 1);
    const finalAttempt = attemptCount >= maxAttempts;
    if (executionId) await store.jobExecution.update({
      where: { id: executionId },
      data: {
        status: finalAttempt ? JobStatus.FAILED : JobStatus.STARTED,
        attemptCount,
        errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Error desconocido.',
        finishedAt: finalAttempt ? new Date() : null,
      },
    });
    throw error;
  }
}
