import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const m = vi.hoisted(() => ({ transaction: vi.fn(), job: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), active: vi.fn(), publish: vi.fn(), meta: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { $transaction = m.transaction; jobExecution = { update: m.update }; } }));
vi.mock('@upstash/qstash', () => ({ Client: class { publishJSON = m.publish; } }));
vi.mock('../instagram-publish', () => ({ publishOne: m.meta, errorMessage: () => 'Revisar resultado en Instagram.' }));
import { enqueueProductPublish, processProductPublish } from './product-publish';
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY']) vi.stubEnv(key, 'test');
  vi.stubEnv('APP_URL', 'https://www.smartbrew.tech');
  m.transaction.mockImplementation(fn => fn({ $queryRaw: vi.fn(), product: { findUniqueOrThrow: vi.fn().mockResolvedValue({ affiliateUrl: 'link', primaryImageUrl: 'image' }) }, publication: { findFirst: m.active }, jobExecution: { findFirst: m.find, findUnique: m.job, create: m.create, update: m.update } }));
  m.create.mockResolvedValue({ id: 'job', outputJson: null });
  m.job.mockResolvedValue({ id: 'job', jobName: 'instagram_product_publish', entityId: 'product', status: 'STARTED', outputJson: null });
});
afterEach(() => vi.unstubAllEnvs());
it('enqueues one durable job and limits consumer concurrency, without calling Meta', async () => {
  await enqueueProductPublish('product');
  expect(m.publish).toHaveBeenCalledWith(expect.objectContaining({ body: { jobId: 'job' }, flowControl: { key: 'smartbrew-product-publish', parallelism: 1 }, deduplicationId: 'job' }));
  expect(m.meta).not.toHaveBeenCalled();
});
it('reuses pending jobs after an uncertain enqueue result', async () => {
  m.find.mockResolvedValue({ id: 'existing', outputJson: null });
  await enqueueProductPublish('product');
  expect(m.create).not.toHaveBeenCalled();
  expect(m.publish.mock.calls[0][0].deduplicationId).toBe('existing');
});
it('fails closed without signing keys', async () => {
  vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', '');
  await expect(enqueueProductPublish('product')).rejects.toThrow('QStash');
  expect(m.transaction).not.toHaveBeenCalled();
});
it('does not hide queue submission failures', async () => {
  m.publish.mockRejectedValue(Error('network'));
  await expect(enqueueProductPublish('product')).rejects.toThrow('No se confirmó');
});
it('marks confirmed publish as completed', async () => {
  await processProductPublish('job');
  expect(m.meta).toHaveBeenCalledWith('product');
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }));
});
it.each(['SUCCEEDED', 'FAILED'])('does not publish again on redelivery of %s', async status => {
  m.job.mockResolvedValue({ jobName: 'instagram_product_publish', entityId: 'product', status });
  await processProductPublish('job'); expect(m.meta).not.toHaveBeenCalled();
});
it('does not repeat a claimed job even if its worker was interrupted', async () => {
  m.job.mockResolvedValue({ jobName: 'instagram_product_publish', entityId: 'product', status: 'STARTED', outputJson: { phase: 'CLAIMED' }, startedAt: new Date(0) });
  await processProductPublish('job'); expect(m.meta).not.toHaveBeenCalled();
  expect(m.update.mock.calls[0][0].data.status).toBe('FAILED');
});
it('records provider failure instead of silently reporting published', async () => {
  m.meta.mockRejectedValue(Error('uncertain'));
  await processProductPublish('job');
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorMessage: 'Revisar resultado en Instagram.' }) }));
});
