import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), job: vi.fn(), publish: vi.fn(), transaction: vi.fn(), upsert: vi.fn(), finish: vi.fn() }));
vi.mock('./portal', () => ({ portalDb: { product: { findUnique: m.find, updateMany: m.update }, jobExecution: { upsert: m.job }, $transaction: m.transaction } }));
vi.mock('@upstash/qstash', () => ({ Client: class { publishJSON = m.publish; } }));
import { parseAffiliateImport } from './affiliate-import-input';
import { processAffiliateImport, saveOrQueueAffiliate } from './affiliate-import';
const data = { url: 'https://www.mercadolibre.com.ar/reloj/p/MLA123#tracking=1', title: 'Reloj', affiliateUrl: 'https://meli.la/test', image: '' };
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
function queueConfig() {
  vi.stubEnv('QSTASH_TOKEN', 'test'); vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'test');
  vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'test'); vi.stubEnv('APP_URL', 'https://www.smartbrew.tech');
  m.find.mockResolvedValue(null); m.job.mockResolvedValue({ status: 'STARTED' });
}
it('publishes only a durable job ID to the fixed consumer endpoint', async () => {
  queueConfig(); m.publish.mockResolvedValue({ messageId: 'msg' });
  const result = await saveOrQueueAffiliate(data, null);
  expect(result).toHaveProperty('jobId');
  expect(m.publish.mock.calls[0][0]).toMatchObject({ url: 'https://www.smartbrew.tech/api/queue/affiliate-import', body: { jobId: result.jobId }, deduplicationId: result.jobId });
});
it('never reports queue success after a failed publish', async () => {
  queueConfig(); m.publish.mockRejectedValue(Error('secret transport error'));
  await expect(saveOrQueueAffiliate(data, null)).rejects.toThrow('No se pudo confirmar');
});
it('requires signing keys before enqueueing new imports', async () => {
  queueConfig(); vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', '');
  await expect(saveOrQueueAffiliate(data, null)).rejects.toThrow('Falta configurar');
  expect(m.publish).not.toHaveBeenCalled();
});
it('normalizes product identity without taking tracking IDs as identity', () => {
  expect(parseAffiliateImport(data)).toMatchObject({ externalId: 'MLA123', url: 'https://www.mercadolibre.com.ar/reloj/p/MLA123' });
});
it.each(['http://www.mercadolibre.com.ar/p/MLA123', 'https://evil.test/p/MLA123', 'https://www.mercadolibre.com.ar/'])('rejects unsafe product URL %s', url => {
  expect(() => parseAffiliateImport({ ...data, url })).toThrow();
});
it('rejects unsafe affiliate links and images', () => {
  expect(() => parseAffiliateImport({ ...data, affiliateUrl: 'https://evil.test/a' })).toThrow();
  expect(() => parseAffiliateImport({ ...data, image: 'http://localhost/a' })).toThrow();
});
it('updates only the affiliate link with a compare-and-swap guard', async () => {
  m.find.mockResolvedValue({ id: 'p', affiliateUrl: null }); m.update.mockResolvedValue({ count: 1 });
  expect(await saveOrQueueAffiliate(data, null)).toMatchObject({ productId: 'p' });
  expect(m.update.mock.calls[0][0].data).toEqual({ affiliateUrl: data.affiliateUrl });
  expect(m.publish).not.toHaveBeenCalled();
});
it('rejects concurrent link changes without queuing or overwriting', async () => {
  m.find.mockResolvedValue({ id: 'p', affiliateUrl: 'https://meli.la/other' }); m.update.mockResolvedValue({ count: 0 });
  await expect(saveOrQueueAffiliate(data, null)).rejects.toThrow('confirmación');
  expect(m.publish).not.toHaveBeenCalled();
});
it('does nothing for an already saved link', async () => {
  m.find.mockResolvedValue({ id: 'p', affiliateUrl: data.affiliateUrl });
  await saveOrQueueAffiliate(data, null);
  expect(m.update).not.toHaveBeenCalled();
});
function worker(status = 'STARTED', count = 1) {
  m.transaction.mockImplementation(fn => fn({ $queryRaw: vi.fn(), jobExecution: { findUnique: vi.fn().mockResolvedValue({ jobName: 'affiliate_import', status, inputJson: data }), update: m.finish }, product: { upsert: m.upsert, updateMany: m.update } }));
  m.upsert.mockResolvedValue({ id: 'p' }); m.update.mockResolvedValue({ count });
}
it('creates a candidate without any publishing and completes the job atomically', async () => {
  worker(); await processAffiliateImport('job');
  expect(m.upsert.mock.calls[0][0]).toMatchObject({ update: {}, create: { status: 'CANDIDATE', affiliateUrl: data.affiliateUrl } });
  expect(m.finish.mock.calls[0][0].data.status).toBe('SUCCEEDED');
});
it('skips already completed deliveries', async () => {
  worker('SUCCEEDED'); await processAffiliateImport('job'); expect(m.upsert).not.toHaveBeenCalled();
});
it('records conflicts instead of replacing a link from another operation', async () => {
  worker('STARTED', 0); await processAffiliateImport('job');
  expect(m.finish.mock.calls[0][0].data.status).toBe('FAILED');
});
