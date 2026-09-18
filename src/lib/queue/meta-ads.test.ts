import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), product: vi.fn(), job: vi.fn(), create: vi.fn(), update: vi.fn(), publish: vi.fn(), meta: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { $transaction = m.transaction; product = { findUniqueOrThrow: m.product }; jobExecution = { update: m.update }; } }));
vi.mock('@upstash/qstash', () => ({ Client: class { publishJSON = m.publish; } }));
vi.mock('../meta-ads', async () => ({ ...await vi.importActual('../meta-ads'), createPausedAd: m.meta }));
import { enqueuePausedAd, processPausedAd } from './meta-ads';
const input = { productId: 'product', currency: 'ARS', budgetMinor: 10000, days: 7, confirmed: true };
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({ APP_URL: 'https://www.smartbrew.tech', QSTASH_TOKEN: 'test', QSTASH_CURRENT_SIGNING_KEY: 'test', QSTASH_NEXT_SIGNING_KEY: 'test', META_ADS_ENABLED: 'true', META_ADS_ACCESS_TOKEN: 'secret', META_ADS_ACCOUNT_ID: '123', META_ADS_PAGE_ID: '456', META_ADS_INSTAGRAM_ID: '789' })) vi.stubEnv(key, value);
  m.product.mockResolvedValue({ title: 'Cafetera', status: 'ACTIVE', affiliateUrl: 'https://meli.la/a', primaryImageUrl: 'https://http2.mlstatic.com/a.jpg' });
  m.job.mockResolvedValue({ id: 'job', jobName: 'meta_paused_ad', status: 'STARTED', outputJson: null, inputJson: { ...input, accountId: '123' } });
  m.create.mockResolvedValue({ id: 'job' });
  m.transaction.mockImplementation(fn => fn({ $queryRaw: vi.fn(), product: { findUniqueOrThrow: m.product }, jobExecution: { findFirst: m.find, findUnique: m.job, create: m.create, update: m.update } }));
});
afterEach(() => vi.unstubAllEnvs());
it('enqueues without contacting Meta from the request', async () => {
  expect(await enqueuePausedAd(input)).toEqual({ id: 'job', existing: false });
  expect(m.publish).toHaveBeenCalledWith(expect.objectContaining({ deduplicationId: 'job', body: { jobId: 'job' } }));
  expect(m.meta).not.toHaveBeenCalled();
});
it('does not create or resend any previously reserved attempt', async () => {
  m.find.mockResolvedValue({ id: 'existing', status: 'FAILED' });
  expect(await enqueuePausedAd(input)).toMatchObject({ existing: true });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.publish).not.toHaveBeenCalled();
});
it('does not enqueue a non-public product', async () => {
  m.product.mockResolvedValue({ status: 'ARCHIVED' });
  await expect(enqueuePausedAd(input)).rejects.toThrow();
  expect(m.publish).not.toHaveBeenCalled();
});
it('retains a reservation when queue delivery is uncertain', async () => {
  m.publish.mockRejectedValue(Error('timeout'));
  await expect(enqueuePausedAd(input)).rejects.toThrow('incierto');
  expect(m.update).not.toHaveBeenCalled();
});
it.each(['SUCCEEDED', 'FAILED'])('does not replay %s jobs', async status => {
  m.job.mockResolvedValue({ jobName: 'meta_paused_ad', status });
  await processPausedAd('job');
  expect(m.meta).not.toHaveBeenCalled();
});
it('does not replay a crashed or running claim', async () => {
  m.job.mockResolvedValue({ jobName: 'meta_paused_ad', status: 'STARTED', outputJson: { phase: 'CLAIMED' } });
  await processPausedAd('job');
  expect(m.meta).not.toHaveBeenCalled();
});
it('preserves partial IDs and records failure without retries or raw secrets', async () => {
  m.meta.mockImplementation(async (_input, _product, checkpoint) => { await checkpoint({ campaigns: '111' }); throw Error('secret-token'); });
  await processPausedAd('job');
  const result = m.update.mock.lastCall![0].data;
  expect(result).toMatchObject({ status: 'FAILED', outputJson: { campaigns: '111', phase: 'REVIEW_REQUIRED' } });
  expect(JSON.stringify(result)).not.toContain('secret-token');
  expect(m.meta).toHaveBeenCalledTimes(1);
});
it('stores successful paused creation', async () => {
  m.meta.mockImplementation(async (_input, _product, checkpoint) => { await checkpoint({ ads: '444' }); });
  await processPausedAd('job');
  expect(m.update.mock.lastCall![0].data).toMatchObject({ status: 'SUCCEEDED', outputJson: { phase: 'PAUSED', ads: '444' } });
});
