import { JobStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  DropshippingJobName,
  enqueueDropshippingJob,
  executeDropshippingJob,
  optionsForDropshippingJob,
} from './dropshipping-jobs';

function store() {
  return {
    jobExecution: {
      create: vi.fn().mockResolvedValue({ id: 'execution-1' }),
      update: vi.fn().mockResolvedValue({ id: 'execution-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'execution-1' }),
    },
  };
}

function handlers() {
  return {
    syncSuppliers: vi.fn().mockResolvedValue({ processed: 1 }),
    syncMarketplaceStock: vi.fn().mockResolvedValue({ synchronized: 1 }),
    syncMarketplacePrices: vi.fn().mockResolvedValue({ updated: 1 }),
    syncMarketplaceFees: vi.fn().mockResolvedValue({ updated: 1 }),
    syncSupplierOrderStatuses: vi.fn().mockResolvedValue({ updated: 1 }),
    createSupplierOrder: vi.fn().mockResolvedValue({ status: 'created' }),
    publishSupplierProduct: vi.fn().mockResolvedValue({ listing: { id: 'listing-1' } }),
  };
}

const withLock = async <T>(_resource: string, task: () => Promise<T>) => task();
const getSettings = vi.fn().mockResolvedValue({
  minimumMargin: 20,
  minimumProfit: 0,
  minimumStock: 1,
  autoPublish: false,
  autoUpdatePrices: true,
  autoPauseNoStock: true,
  autoSupplierPurchase: false,
  priceChangeLimit: 20,
  supplierSyncInterval: 15,
});

describe('dropshipping jobs', () => {
  it('configures exponential retries for idempotent synchronization jobs', () => {
    expect(optionsForDropshippingJob(DropshippingJobName.SupplierCatalogSyncJob)).toMatchObject({
      attempts: 4,
      backoff: { type: 'exponential', delay: 30_000 },
    });
    expect(optionsForDropshippingJob(DropshippingJobName.SupplierOrderJob).attempts).toBe(1);
    expect(optionsForDropshippingJob(DropshippingJobName.MarketplacePublishJob).attempts).toBe(1);
  });

  it('persists and enqueues jobs without running the external operation in the caller', async () => {
    const database = store();
    const queue = { add: vi.fn().mockResolvedValue({ id: 'execution-1' }) };
    const result = await enqueueDropshippingJob(DropshippingJobName.SupplierOrderJob, { orderId: 'order-1' }, {
      queue: queue as never,
      store: database as never,
    });
    expect(result).toEqual({ status: 'queued', jobId: 'execution-1' });
    expect(database.jobExecution.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      jobName: DropshippingJobName.SupplierOrderJob,
      status: JobStatus.STARTED,
      maxAttempts: 1,
    }) });
    expect(queue.add).toHaveBeenCalledWith(
      DropshippingJobName.SupplierOrderJob,
      { orderId: 'order-1', executionId: 'execution-1' },
      expect.objectContaining({ attempts: 1, jobId: 'execution-1' }),
    );
  });

  it('records queue failures as failed jobs', async () => {
    const database = store();
    const queue = { add: vi.fn().mockRejectedValue(new Error('redis unavailable')) };
    await expect(enqueueDropshippingJob(DropshippingJobName.MarketplaceStockSyncJob, {}, {
      queue: queue as never,
      store: database as never,
    })).rejects.toThrow('redis unavailable');
    expect(database.jobExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.FAILED }),
    }));
  });

  it('executes a worker handler and records success', async () => {
    const database = store();
    const operations = handlers();
    await executeDropshippingJob({
      name: DropshippingJobName.MarketplacePriceSyncJob,
      id: 'bull-job-1',
      data: { executionId: 'execution-1' },
      attemptsMade: 0,
      opts: { attempts: 4 },
    } as never, { handlers: operations as never, store: database as never, withLock, getSettings });
    expect(operations.syncMarketplacePrices).toHaveBeenCalledWith({
      minimumProfitPercentage: 20,
      minimumProfitAmount: 0,
      maximumPriceChangePercentage: 20,
    });
    expect(database.jobExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.SUCCEEDED, attemptCount: 1 }),
    }));
  });

  it('keeps automatic marketplace price updates disabled with the safe default', async () => {
    const database = store();
    const operations = handlers();
    const disabledSettings = vi.fn().mockResolvedValue({ ...(await getSettings()), autoUpdatePrices: false });
    const result = await executeDropshippingJob({
      name: DropshippingJobName.MarketplacePriceSyncJob,
      id: 'bull-job-disabled',
      data: { executionId: 'execution-1' },
      attemptsMade: 0,
      opts: { attempts: 4 },
    } as never, { handlers: operations as never, store: database as never, withLock, getSettings: disabledSettings });
    expect(result).toEqual({ status: 'disabled' });
    expect(operations.syncMarketplacePrices).not.toHaveBeenCalled();
  });

  it('keeps retryable failures active and stores the final failure', async () => {
    const database = store();
    const operations = handlers();
    operations.syncMarketplaceStock.mockRejectedValue(new Error('temporary failure'));
    const job = { id: 'bull-job-1', name: DropshippingJobName.MarketplaceStockSyncJob, data: { executionId: 'execution-1' }, attemptsMade: 0, opts: { attempts: 4 } };

    await expect(executeDropshippingJob(job as never, { handlers: operations as never, store: database as never, withLock, getSettings })).rejects.toThrow();
    expect(database.jobExecution.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.STARTED, attemptCount: 1, finishedAt: null }),
    }));

    job.attemptsMade = 3;
    await expect(executeDropshippingJob(job as never, { handlers: operations as never, store: database as never, withLock, getSettings })).rejects.toThrow();
    expect(database.jobExecution.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.FAILED, attemptCount: 4 }),
    }));
  });

  it('creates persistent execution tracking for scheduler-generated jobs', async () => {
    const database = store();
    const operations = handlers();
    await executeDropshippingJob({
      id: 'repeat:catalog:123',
      name: DropshippingJobName.SupplierCatalogSyncJob,
      data: {},
      attemptsMade: 0,
      opts: { attempts: 4 },
    } as never, { handlers: operations as never, store: database as never, withLock });
    expect(database.jobExecution.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'repeat:catalog:123' },
      create: expect.objectContaining({ jobName: DropshippingJobName.SupplierCatalogSyncJob, maxAttempts: 4 }),
    }));
  });
});
