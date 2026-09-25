import { Job, JobsOptions, Queue } from 'bullmq';
import Redis from 'ioredis';
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
type QueueLike = Pick<Queue, 'add'>;
type JobStore = Pick<typeof portalDb, 'jobExecution'>;

let connection: Redis | undefined;
let queue: Queue | undefined;

export function dropshippingQueue() {
  if (!connection) connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
  if (!queue) queue = new Queue('affiliate-jobs', { connection });
  return queue;
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

export async function enqueueDropshippingJob(
  name: DropshippingJobName,
  data: Record<string, unknown>,
  dependencies: { queue?: QueueLike; store?: JobStore } = {},
) {
  const selectedQueue = dependencies.queue || dropshippingQueue();
  const store = dependencies.store || portalDb;
  const options = optionsForDropshippingJob(name);
  const maxAttempts = Number(options.attempts || 1);
  const execution = await store.jobExecution.create({
    data: { jobName: name, status: JobStatus.STARTED, inputJson: json(data), maxAttempts },
  });
  try {
    const queued = await selectedQueue.add(name, { ...data, executionId: execution.id }, { ...options, jobId: execution.id });
    return { status: 'queued' as const, jobId: queued.id || execution.id };
  } catch (error) {
    await store.jobExecution.update({
      where: { id: execution.id },
      data: { status: JobStatus.FAILED, errorMessage: 'No se pudo encolar el trabajo.', finishedAt: new Date() },
    });
    throw error;
  }
}

type JobHandlers = {
  syncSuppliers: typeof syncSuppliers;
  syncMarketplaceStock: typeof syncMarketplaceStock;
  syncMarketplacePrices: typeof syncMarketplacePrices;
  syncMarketplaceFees: typeof syncMarketplaceFees;
  syncSupplierOrderStatuses: typeof syncSupplierOrderStatuses;
  createSupplierOrder: typeof createSupplierOrder;
  publishSupplierProduct: typeof publishSupplierProduct;
};

const defaultHandlers: JobHandlers = {
  syncSuppliers,
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
      case DropshippingJobName.SupplierCatalogSyncJob:
      case DropshippingJobName.SupplierStockSyncJob:
      case DropshippingJobName.SupplierPriceSyncJob: {
        const data = syncJob.parse(job.data);
        return handlers.syncSuppliers({ supplierId: data.supplierId });
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
