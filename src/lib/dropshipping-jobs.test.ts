import { JobStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DropshippingJobName,
  enqueueDropshippingJob,
  dispatchScheduledDropshippingJobs,
  ensureDropshippingQStashSchedule,
  executeDropshippingJob,
  optionsForDropshippingJob,
  processDropshippingQStashJob,
} from './dropshipping-jobs';

function store() {
  return {
    jobExecution: {
      create: vi.fn().mockResolvedValue({ id: 'execution-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'execution-1' }),
      upsert: vi.fn().mockResolvedValue({ id: 'execution-1' }),
    },
  };
}

function handlers() {
  return {
    syncSuppliers: vi.fn().mockResolvedValue({ processed: 1 }),
    monitorPublishedSupplierProducts: vi.fn().mockResolvedValue({ inspected: 1 }),
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
  beforeEach(() => {
    vi.stubEnv('QSTASH_TOKEN', 'test-token');
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current-key');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next-key');
    vi.stubEnv('APP_URL', 'https://www.smartbrew.tech');
  });

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
    const publisher = { publishJSON: vi.fn().mockResolvedValue({ messageId: 'message-1' }) };
    const result = await enqueueDropshippingJob(DropshippingJobName.SupplierOrderJob, { orderId: 'order-1' }, {
      publisher: publisher as never,
      store: database as never,
    });
    expect(result).toEqual({ status: 'queued', jobId: 'execution-1' });
    expect(database.jobExecution.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      jobName: DropshippingJobName.SupplierOrderJob,
      status: JobStatus.STARTED,
      maxAttempts: 1,
    }) });
    expect(publisher.publishJSON).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://www.smartbrew.tech/api/queue/dropshipping',
      body: { jobId: 'execution-1' },
      deduplicationId: 'execution-1',
      retries: 0,
    }));
  });

  it('records queue failures as failed jobs', async () => {
    const database = store();
    const publisher = { publishJSON: vi.fn().mockRejectedValue(new Error('qstash unavailable')) };
    await expect(enqueueDropshippingJob(DropshippingJobName.MarketplaceStockSyncJob, {}, {
      publisher: publisher as never,
      store: database as never,
    })).rejects.toThrow('QStash');
    expect(database.jobExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.FAILED }),
    }));
  });

  it('links marketplace publication jobs to their supplier product', async () => {
    const database = store();
    const publisher = { publishJSON: vi.fn().mockResolvedValue({ messageId: 'message-1' }) };
    await enqueueDropshippingJob(DropshippingJobName.MarketplacePublishJob, {
      supplierProductId: 'product-1', marketplaceAccountId: '84259783', marketplaceFee: 0,
      shippingCost: 0, taxes: 0, extraCosts: 0, targetMarginPercentage: 20,
    }, { publisher: publisher as never, store: database as never });
    expect(database.jobExecution.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      entityType: 'SupplierProduct', entityId: 'product-1',
    }) });
  });

  it('creates one labeled QStash schedule and repairs duplicates', async () => {
    const schedules = {
      list: vi.fn().mockResolvedValue([
        { scheduleId: 'schedule-1', destination: 'old', cron: '0 * * * *', labels: ['smartbrew-dropshipping-sync'] },
        { scheduleId: 'schedule-duplicate', destination: 'old', cron: '0 * * * *', labels: ['smartbrew-dropshipping-sync'] },
      ]),
      create: vi.fn().mockResolvedValue({ scheduleId: 'schedule-1' }),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    await expect(ensureDropshippingQStashSchedule(schedules)).resolves.toEqual({
      scheduleId: 'schedule-1', repaired: true, removedDuplicates: 1,
    });
    expect(schedules.create).toHaveBeenCalledWith(expect.objectContaining({
      scheduleId: 'schedule-1',
      destination: 'https://www.smartbrew.tech/api/queue/dropshipping',
      cron: '* * * * *',
      body: JSON.stringify({ schedule: 'dropshipping' }),
    }));
    expect(schedules.delete).toHaveBeenCalledWith('schedule-duplicate');
  });

  it('dispatches the supplier, stock and price chain through QStash when due', async () => {
    const database = store();
    database.jobExecution.create
      .mockResolvedValueOnce({ id: 'dispatch-1' })
      .mockResolvedValueOnce({ id: 'supplier-1' })
      .mockResolvedValueOnce({ id: 'stock-1' })
      .mockResolvedValueOnce({ id: 'price-1' });
    const publisher = { publishJSON: vi.fn().mockResolvedValue({ messageId: 'message-1' }) };
    const result = await dispatchScheduledDropshippingJobs({
      store: database as never,
      publisher: publisher as never,
      getSettings,
      now: () => new Date('2026-09-28T20:00:00Z'),
    });
    expect(result).toEqual({ status: 'queued', jobs: ['supplier-1', 'stock-1', 'price-1'] });
    expect(publisher.publishJSON).toHaveBeenCalledTimes(3);
    expect(database.jobExecution.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ jobName: DropshippingJobName.SupplierStockSyncJob }) });
    expect(database.jobExecution.create).toHaveBeenNthCalledWith(3, { data: expect.objectContaining({ jobName: DropshippingJobName.MarketplaceStockSyncJob }) });
    expect(database.jobExecution.create).toHaveBeenNthCalledWith(4, { data: expect.objectContaining({ jobName: DropshippingJobName.MarketplacePriceSyncJob }) });
  });

  it('does not dispatch the scheduled chain before the configured interval', async () => {
    const database = store();
    database.jobExecution.findFirst.mockResolvedValue({ startedAt: new Date('2026-09-28T19:50:00Z') });
    const publisher = { publishJSON: vi.fn() };
    await expect(dispatchScheduledDropshippingJobs({
      store: database as never,
      publisher: publisher as never,
      getSettings,
      now: () => new Date('2026-09-28T20:00:00Z'),
    })).resolves.toMatchObject({ status: 'not_due' });
    expect(publisher.publishJSON).not.toHaveBeenCalled();
  });

  it('loads and executes a persisted QStash job exactly once', async () => {
    const database = store();
    const operations = handlers();
    database.jobExecution.findUnique.mockResolvedValue({
      id: 'execution-1',
      jobName: DropshippingJobName.MarketplaceStockSyncJob,
      status: JobStatus.STARTED,
      inputJson: {},
      attemptCount: 0,
      maxAttempts: 4,
    });
    await processDropshippingQStashJob('execution-1', {
      store: database as never,
      handlers: operations as never,
      withLock,
      getSettings,
    });
    expect(operations.syncMarketplaceStock).toHaveBeenCalledOnce();
    expect(database.jobExecution.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.SUCCEEDED }),
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

  it('uses targeted published-product monitoring for supplier price and stock jobs', async () => {
    const database = store();
    const operations = handlers();
    for (const name of [DropshippingJobName.SupplierPriceSyncJob, DropshippingJobName.SupplierStockSyncJob]) {
      await executeDropshippingJob({
        name,
        id: `bull-${name}`,
        data: { executionId: 'execution-1', supplierId: 'supplier-1' },
        attemptsMade: 0,
        opts: { attempts: 4 },
      } as never, { handlers: operations as never, store: database as never, withLock });
    }
    expect(operations.monitorPublishedSupplierProducts).toHaveBeenCalledTimes(2);
    expect(operations.monitorPublishedSupplierProducts).toHaveBeenCalledWith({ supplierId: 'supplier-1' });
    expect(operations.syncSuppliers).not.toHaveBeenCalled();
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

  it('propagates a total supplier monitoring failure so the queue can retry it', async () => {
    const database = store();
    const operations = handlers();
    operations.monitorPublishedSupplierProducts.mockRejectedValue(new Error('all supplier requests failed'));

    await expect(executeDropshippingJob({
      id: 'supplier-price-job',
      name: DropshippingJobName.SupplierPriceSyncJob,
      data: { executionId: 'execution-1' },
      attemptsMade: 0,
      opts: { attempts: 4 },
    } as never, { handlers: operations as never, store: database as never, withLock })).rejects.toThrow('all supplier requests failed');

    expect(database.jobExecution.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: JobStatus.STARTED, attemptCount: 1, finishedAt: null }),
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
