import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), lock: vi.fn(), product: vi.fn(), active: vi.fn(), draft: vi.fn(), create: vi.fn(), update: vi.fn(), list: vi.fn(), meta: vi.fn(), audit: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  $transaction = m.transaction;
  publication = { update: m.update, findMany: m.list };
} }));
vi.mock('@/lib/session', () => ({ getSession: m.auth }));
vi.mock('@/lib/logger', () => ({ logSystemEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/meta-api', async () => ({ ...await import('../../../../lib/meta-api'), requestMeta: m.meta }));
import { MetaApiError } from '@/lib/meta-api';
import { publishToInstagramAction, unpublishFromInstagramAction, verifyInstagramPublicationAction, reconcileInstagramPublicationAction } from './actions';
import { runPublicationAction } from '../../../../lib/publication-client';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'test-token'); vi.stubEnv('INSTAGRAM_ACCOUNT_ID', '123');
  vi.stubEnv('META_GRAPH_API_BASE_URL', 'https://graph.instagram.com'); vi.stubEnv('META_GRAPH_API_VERSION', 'v21.0');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN', '');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID', '');
  vi.stubEnv('INSTAGRAM_DELETE_GRAPH_API_VERSION', 'v26.0');
  m.auth.mockResolvedValue({ userId: 'admin' });
  m.lock.mockResolvedValue([{ id: 'product' }]);
  m.product.mockResolvedValue({ id: 'product', affiliateUrl: 'https://example.org/product', primaryImageUrl: 'https://example.org/image.jpg' });
  m.active.mockResolvedValue(null); m.draft.mockResolvedValue({ id: 'draft', caption: 'Product' });
  m.create.mockResolvedValue({ id: 'publication' }); m.update.mockResolvedValue({});
  m.transaction.mockImplementation(fn => fn({ $queryRaw: m.lock, product: { findUniqueOrThrow: m.product }, publication: { findFirst: m.active, create: m.create, findMany: m.list, update: m.update }, contentDraft: { findFirst: m.draft }, systemLog: { create: m.audit } }));
  m.meta.mockResolvedValueOnce({ id: '111' }).mockResolvedValueOnce({ id: '222' });
  m.list.mockResolvedValue([{ id: 'publication', externalMediaId: '222' }]);
});
afterEach(() => vi.unstubAllEnvs());
it('requires an admin session before every operation', async () => {
  m.auth.mockResolvedValue(null);
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect((await verifyInstagramPublicationAction('product')).success).toBe(false);
  expect((await unpublishFromInstagramAction(['product'])).success).toBe(false);
  expect((await reconcileInstagramPublicationAction('product', 'publication', 'Verificado manualmente', true)).success).toBe(false);
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.meta).not.toHaveBeenCalled();
});
it('retires only the selected record and audits without contacting Meta or removing IDs', async () => {
  setupDeletion();
  expect((await reconcileInstagramPublicationAction('product', 'publication', 'Cuenta revisada; post no localizado', true)).success).toBe(true);
  expect(m.list).toHaveBeenCalledWith({ where: { draft: { productId: 'product' }, platform: 'INSTAGRAM', deletedAt: null } });
  expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ details: expect.objectContaining({ actor: 'admin', externalMediaId: '222', remoteDeletionConfirmed: false }) }) }));
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'publication' }, data: { deletedAt: expect.any(Date), lastErrorCode: 'ADMIN_RETIRED', lastErrorMessage: expect.stringContaining('sin confirmación de Meta') } });
  expect(m.meta).not.toHaveBeenCalled();
});
it.each([[false, 'Motivo suficientemente largo'], [true, ''], [true, 'corto'], [true, 'x'.repeat(1001)]])('requires explicit confirmation and a valid reason', async (confirmation, reason) => {
  expect((await reconcileInstagramPublicationAction('product', 'publication', reason as string, confirmation as boolean)).success).toBe(false);
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['QUEUED', 'UPLOADING', 'PROCESSING', 'DELETE_IN_PROGRESS'])('rejects reconciliation during %s', async state => {
  m.list.mockResolvedValue([{ id: 'publication', status: state === 'DELETE_IN_PROGRESS' ? 'PUBLISHED' : state, lastErrorCode: state }]);
  expect((await reconcileInstagramPublicationAction('product', 'publication', 'Revisión administrativa', true)).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled(); expect(m.audit).not.toHaveBeenCalled();
});
it('rejects stale or cross-product publication IDs', async () => {
  setupDeletion();
  expect((await reconcileInstagramPublicationAction('product', 'different', 'Revisión administrativa', true)).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('does not retire the record if audit persistence fails', async () => {
  setupDeletion(); m.audit.mockRejectedValue(Error('Audit database unavailable'));
  expect((await reconcileInstagramPublicationAction('product', 'publication', 'Revisión administrativa', true)).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('does not report reconciliation success when the transaction fails', async () => {
  m.transaction.mockRejectedValue(Error('Rollback'));
  expect((await reconcileInstagramPublicationAction('product', 'publication', 'Revisión administrativa', true)).success).toBe(false);
});
it('serializes duplicate administrative retirements', async () => {
  setupDeletion();
  let retired = false;
  let tail = Promise.resolve();
  const transaction = m.transaction.getMockImplementation()!;
  m.list.mockImplementation(async () => retired ? [] : [{ id: 'publication', status: 'PUBLISHED', externalMediaId: '222' }]);
  m.update.mockImplementation(async () => { retired = true; return {}; });
  m.transaction.mockImplementation(fn => { const next = tail.then(() => transaction(fn)); tail = next.catch(() => undefined); return next; });
  const results = await Promise.all([1, 2].map(() => reconcileInstagramPublicationAction('product', 'publication', 'Revisión administrativa', true)));
  expect(results.filter(r => r.success)).toHaveLength(1);
  expect(m.audit).toHaveBeenCalledTimes(1); expect(m.update).toHaveBeenCalledTimes(1);
});
it('reports already-published as an error without calling Meta', async () => {
  m.active.mockResolvedValue({ status: 'PUBLISHED' });
  expect(await publishToInstagramAction(['product'])).toMatchObject({ success: false, published: 0 });
  expect(m.meta).not.toHaveBeenCalled();
});
it('checks all drafts under a product row lock and persists a claim before Meta', async () => {
  expect(await publishToInstagramAction(['product', 'product'])).toMatchObject({ success: true, published: 1 });
  expect(m.lock).toHaveBeenCalled();
  expect(m.active).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ draft: { productId: 'product' }, deletedAt: null }) }));
  expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(m.meta.mock.invocationCallOrder[0]);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED', externalMediaId: '222' }) }));
});
it('rejects false or malformed container responses without publishing', async () => {
  m.meta.mockReset().mockResolvedValue(false);
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.meta).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
});
it('blocks retries when media_publish returns no valid confirmation', async () => {
  m.meta.mockReset().mockResolvedValueOnce({ id: '111' }).mockResolvedValueOnce({ success: false });
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING', lastErrorCode: 'RECONCILIATION_REQUIRED' }) }));
});
it('preserves an uncertain claim after a publishing timeout', async () => {
  m.meta.mockReset().mockResolvedValueOnce({ id: '111' }).mockRejectedValueOnce(new MetaApiError({ operation: 'publish', status: null, message: 'Timeout' }));
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING' }) }));
});
it('keeps confirmed remote ID when saving the published status fails', async () => {
  m.update.mockResolvedValueOnce({}).mockRejectedValueOnce(Error('DB failed')).mockResolvedValueOnce({});
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING', externalMediaId: '222' }) }));
});
it('reports a definitive Meta rejection as failure', async () => {
  m.meta.mockReset().mockRejectedValue(new MetaApiError({ operation: 'create', status: 403, message: 'Permission denied' }));
  expect(await publishToInstagramAction(['product'])).toMatchObject({ success: false, published: 0, message: 'Permission denied' });
});
it.each([401, 403, 404, 429, 500])('verification HTTP %s never mutates publication data', async status => {
  m.meta.mockReset().mockRejectedValue(new MetaApiError({ operation: 'verify', status, message: 'Unavailable' }));
  expect(await verifyInstagramPublicationAction('product')).toMatchObject({ success: false, status: 'UNCONFIRMED' });
  expect(m.update).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
});
it('verifies the returned ID, not just HTTP success', async () => {
  expect((await verifyInstagramPublicationAction('product')).success).toBe(false);
  m.meta.mockReset().mockResolvedValue({ id: '222' });
  expect((await verifyInstagramPublicationAction('product')).success).toBe(true);
});
it('unconfigured deletion never changes any data or calls Meta', async () => {
  expect((await unpublishFromInstagramAction(['product'])).success).toBe(false);
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.meta).not.toHaveBeenCalled();
});
function setupDeletion() {
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN', 'separate-facebook-token');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID', '999');
  m.list.mockResolvedValue([{ id: 'publication', externalMediaId: '222', status: 'PUBLISHED', lastErrorCode: null }]);
  m.meta.mockReset().mockResolvedValueOnce({ id: '222', owner: { id: '999' } }).mockResolvedValueOnce({ success: true, deleted_id: '222' });
}
it('deletes using a separate Facebook token and only soft deletes after exact confirmation', async () => {
  setupDeletion();
  expect(await unpublishFromInstagramAction(['product', 'product'])).toMatchObject({ success: true, deleted: 1 });
  expect(m.meta).toHaveBeenLastCalledWith(expect.any(String), 'https://graph.facebook.com/v26.0/222', expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer separate-facebook-token' } }));
  expect(m.update).toHaveBeenLastCalledWith({ where: { id: 'publication' }, data: { deletedAt: expect.any(Date), lastErrorCode: null, lastErrorMessage: null } });
  expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.meta.mock.invocationCallOrder[0]);
});
it.each([false, { success: false }, { success: true }, { success: true, deleted_id: '333' }])('does not soft delete for invalid confirmation %j', async response => {
  setupDeletion();
  m.meta.mockReset().mockResolvedValueOnce({ id: '222', owner: { id: '999' } }).mockResolvedValueOnce(response);
  expect(await unpublishFromInstagramAction(['product'])).toMatchObject({ success: false, deleted: 0 });
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastErrorCode: 'DELETE_RECONCILIATION_REQUIRED' }) }));
  expect(m.update.mock.calls.every(([arg]) => !arg.data.deletedAt)).toBe(true);
});
it('never deletes media belonging to another account', async () => {
  setupDeletion(); m.meta.mockReset().mockResolvedValue({ id: '222', owner: { id: '111' } });
  expect((await unpublishFromInstagramAction(['product'])).success).toBe(false);
  expect(m.meta).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastErrorCode: 'DELETE_REJECTED' }) }));
});
it.each([403, 404, 500, null])('preserves data when DELETE fails with %s', async status => {
  setupDeletion();
  m.meta.mockReset().mockResolvedValueOnce({ id: '222', owner: { id: '999' } }).mockRejectedValueOnce(new MetaApiError({ operation: 'delete', status, message: 'Failed' }));
  expect((await unpublishFromInstagramAction(['product'])).success).toBe(false);
  expect(m.update.mock.calls.every(([arg]) => !arg.data.deletedAt)).toBe(true);
});
it('blocks deletion pending reconciliation or concurrent publication', async () => {
  setupDeletion();
  m.list.mockResolvedValue([{ id: 'publication', externalMediaId: '222', status: 'PUBLISHED', lastErrorCode: 'DELETE_RECONCILIATION_REQUIRED' }]);
  expect((await unpublishFromInstagramAction(['product'])).success).toBe(false);
  expect(m.meta).not.toHaveBeenCalled();
});
it('does not report success if saving the confirmed deletion fails', async () => {
  setupDeletion();
  m.update.mockResolvedValueOnce({}).mockRejectedValueOnce(Error('DB down')).mockResolvedValueOnce({});
  expect(await unpublishFromInstagramAction(['product'])).toMatchObject({ success: false, deleted: 0 });
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastErrorCode: 'DELETE_RECONCILIATION_REQUIRED' }) }));
});
it('rejects invalid deletion input before mutation', async () => {
  setupDeletion(); expect((await unpublishFromInstagramAction([])).success).toBe(false);
  expect(m.transaction).not.toHaveBeenCalled(); expect(m.meta).not.toHaveBeenCalled();
});
it('reports partial deletion instead of a false batch success', async () => {
  setupDeletion();
  m.meta.mockReset()
    .mockResolvedValueOnce({ id: '222', owner: { id: '999' } })
    .mockResolvedValueOnce({ success: true, deleted_id: '222' })
    .mockRejectedValueOnce(new MetaApiError({ operation: 'verify owner', status: 403, message: 'Denied' }));
  expect(await unpublishFromInstagramAction(['product', 'other'])).toMatchObject({ success: false, deleted: 1 });
  expect(m.update.mock.calls.filter(([arg]) => arg.data.deletedAt)).toHaveLength(1);
});
it('serializes competing deletes before calling Meta', async () => {
  setupDeletion();
  let code: string | null = null;
  let tail = Promise.resolve();
  const transaction = m.transaction.getMockImplementation()!;
  m.list.mockImplementation(async () => [{ id: 'publication', externalMediaId: '222', status: 'PUBLISHED', lastErrorCode: code }]);
  m.update.mockImplementation(async ({ data }) => { if (data.lastErrorCode) code = data.lastErrorCode; return {}; });
  m.transaction.mockImplementation(fn => { const next = tail.then(() => transaction(fn)); tail = next.catch(() => undefined); return next; });
  const results = await Promise.all([unpublishFromInstagramAction(['product']), unpublishFromInstagramAction(['product'])]);
  expect(results.filter(r => r.success)).toHaveLength(1);
  expect(m.meta).toHaveBeenCalledTimes(2);
});
it('blocks a competing request once the serialized claim is visible', async () => {
  // Models the product row lock: each transaction observes the previous committed claim.
  let claimed = false;
  let tail = Promise.resolve();
  const transaction = m.transaction.getMockImplementation()!;
  m.active.mockImplementation(async () => claimed ? { status: 'UPLOADING' } : null);
  m.create.mockImplementation(async () => { claimed = true; return { id: 'publication' }; });
  m.transaction.mockImplementation(fn => { const next = tail.then(() => transaction(fn)); tail = next.catch(() => undefined); return next; });
  const results = await Promise.all([publishToInstagramAction(['product']), publishToInstagramAction(['product'])]);
  expect(results.filter(r => r.success)).toHaveLength(1);
  expect(m.meta).toHaveBeenCalledTimes(2); expect(m.create).toHaveBeenCalledTimes(1);
});
it('client treats a lost action response as a failure', async () => {
  expect(await runPublicationAction(async () => { throw Error('network'); })).toMatchObject({ success: false });
});
