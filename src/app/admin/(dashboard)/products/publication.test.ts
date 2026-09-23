import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/instagram-publish', async () => await import('../../../../lib/instagram-publish'));
const m = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), lock: vi.fn(), product: vi.fn(), active: vi.fn(), draft: vi.fn(), create: vi.fn(), update: vi.fn(), list: vi.fn(), meta: vi.fn(), audit: vi.fn(), wait: vi.fn(), containerStatus: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  $transaction = m.transaction;
  publication = { update: m.update, findMany: m.list };
} }));
vi.mock('@/lib/session', () => ({ getSession: m.auth }));
vi.mock('@/lib/logger', () => ({ logSystemEvent: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/meta-api', async () => ({ ...await import('../../../../lib/meta-api'), requestMeta: m.meta }));
vi.mock('@/lib/instagram-container', async () => ({ ...await import('../../../../lib/instagram-container'), waitForInstagramContainer: m.wait, getInstagramContainerStatus: m.containerStatus }));
import { InstagramContainerError } from '../../../../lib/instagram-container';
import { MetaApiError } from '@/lib/meta-api';
import { inspectFacebookInstagramAction, publishToInstagramAction, unpublishFromInstagramAction, verifyInstagramPublicationAction, reconcileInstagramPublicationAction, resumeInstagramPublicationAction } from './actions';
import { runPublicationAction } from '../../../../lib/publication-client';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('INSTAGRAM_ACCESS_TOKEN', 'test-token'); vi.stubEnv('INSTAGRAM_ACCOUNT_ID', '123');
  vi.stubEnv('META_GRAPH_API_BASE_URL', 'https://graph.instagram.com'); vi.stubEnv('META_GRAPH_API_VERSION', 'v21.0');
  vi.stubEnv('APP_URL', 'https://www.smartbrew.tech'); vi.stubEnv('INSTAGRAM_IMAGE_ALLOWED_HOSTS', 'example.org');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN', '');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID', '');
  vi.stubEnv('INSTAGRAM_DELETE_GRAPH_API_VERSION', 'v26.0');
  m.auth.mockResolvedValue({ userId: 'admin' });
  m.lock.mockResolvedValue([{ id: 'product' }]);
  m.product.mockResolvedValue({ id: 'product', affiliateUrl: 'https://example.org/product', primaryImageUrl: 'https://example.org/image.jpg' });
  m.active.mockResolvedValue(null); m.draft.mockResolvedValue({ id: 'draft', caption: 'Product' });
  m.create.mockResolvedValue({ id: 'publication' }); m.update.mockResolvedValue({});
  m.containerStatus.mockResolvedValue('FINISHED');
  m.transaction.mockImplementation(fn => fn({ $queryRaw: m.lock, product: { findUniqueOrThrow: m.product }, publication: { findFirst: m.active, create: m.create, findMany: m.list, update: m.update }, contentDraft: { findFirst: m.draft }, systemLog: { create: m.audit } }));
  m.meta.mockResolvedValueOnce({ id: '111' }).mockResolvedValueOnce({ id: '222' });
  m.list.mockResolvedValue([{ id: 'publication', externalMediaId: '222' }]);
});
afterEach(() => vi.unstubAllEnvs());
it('publishes all unique images as one ordered carousel, with caption on the parent only', async () => {
  m.product.mockResolvedValue({ id: 'product', affiliateUrl: 'https://example.org/product', primaryImageUrl: 'https://example.org/a.jpg', imageUrls: ['https://example.org/a.jpg', 'https://example.org/b.jpg', 'https://example.org/c.jpg'] });
  m.meta.mockReset();
  m.meta.mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '12' }).mockResolvedValueOnce({ id: '13' }).mockResolvedValueOnce({ id: '100' }).mockResolvedValueOnce({ id: '200' });
  expect((await publishToInstagramAction(['product'])).success).toBe(true);
  expect(m.meta).toHaveBeenCalledTimes(5);
  for (let index = 0; index < 3; index++) {
    const body = m.meta.mock.calls[index][2].body;
    expect(body.get('is_carousel_item')).toBe('true');
    expect(body.has('caption')).toBe(false);
    const imageUrl = new URL(body.get('image_url'));
    expect(`${imageUrl.origin}${imageUrl.pathname}`).toBe('https://www.smartbrew.tech/api/media/instagram-image');
    expect(imageUrl.searchParams.get('url')).toBe(`https://example.org/${['a', 'b', 'c'][index]}.jpg`);
    expect(imageUrl.searchParams.get('sig')).toMatch(/^[a-f0-9]{64}$/);
  }
  const parent = m.meta.mock.calls[3][2].body;
  expect(parent.get('media_type')).toBe('CAROUSEL');
  expect(parent.get('children')).toBe('11,12,13');
  expect(parent.get('caption')).toContain('Comentá');
  expect(m.meta.mock.calls[4][2].body.get('creation_id')).toBe('100');
  expect(m.wait.mock.calls.map(call => call[2])).toEqual(['11', '12', '13', '100']);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED', externalMediaId: '200' }) }));
});
it('does not publish an incomplete carousel if a child fails', async () => {
  m.product.mockResolvedValue({ id: 'product', affiliateUrl: 'https://example.org/product', primaryImageUrl: 'https://example.org/a.jpg', imageUrls: ['https://example.org/b.jpg'] });
  m.meta.mockReset().mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '12' });
  m.wait.mockRejectedValueOnce(new InstagramContainerError('Invalid image', false)).mockResolvedValueOnce(undefined);
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.meta).toHaveBeenCalledTimes(2);
  expect(m.meta.mock.calls.some(call => call[1].endsWith('/media_publish'))).toBe(false);
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }));
});
it('rejects more than ten images without silently truncating or calling Meta', async () => {
  m.product.mockResolvedValue({ id: 'product', affiliateUrl: 'https://example.org/product', primaryImageUrl: 'https://example.org/a.jpg', imageUrls: Array.from({ length: 10 }, (_, index) => `https://example.org/${index}.jpg`) });
  expect((await publishToInstagramAction(['product'])).message).toContain('más de 10');
  expect(m.meta).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it('rejects products whose stored gallery only contains Mercado Libre videos', async () => {
  m.product.mockResolvedValue({
    id: 'product',
    affiliateUrl: 'https://example.org/product',
    primaryImageUrl: 'https://http2.mlstatic.com/demo.mp4',
    imageUrls: ['https://http2.mlstatic.com/demo.webm'],
  });
  const result = await publishToInstagramAction(['product']);
  expect(result).toMatchObject({ success: false });
  expect(result.message).toContain('no tiene imágenes compatibles');
  expect(m.meta).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it('includes the comment-to-DM invitation and affiliate link in product captions', async () => {
  expect((await publishToInstagramAction(['product'])).success).toBe(true);
  const caption = m.meta.mock.calls[0][2].body.get('caption');
  expect(caption).toBe('Product\n\n💬 Comentá "Info", "Precio" o "Quiero" y te enviamos el enlace del producto por mensaje privado.\n\nLink: https://example.org/product');
});
it('does not duplicate an existing invitation or affiliate link', async () => {
  const caption = 'Product\n\n💬 Comentá "Info", "Precio" o "Quiero" y te enviamos el enlace del producto por mensaje privado.\n\nLink: https://example.org/product';
  m.draft.mockResolvedValue({ id: 'draft', caption });
  expect((await publishToInstagramAction(['product'])).success).toBe(true);
  expect(m.meta.mock.calls[0][2].body.get('caption')).toBe(caption);
});
function setupInspection() {
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN', 'facebook-secret');
  vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID', '123');
  m.meta.mockReset();
  m.meta.mockResolvedValueOnce({ id: '123', username: 'smartbrewmrl' });
}
it('reads the configured Facebook account without database writes or portal credentials', async () => {
  setupInspection();
  const result = await inspectFacebookInstagramAction('product');
  expect(result).toMatchObject({ success: true, account: { id: '123', username: 'smartbrewmrl' } });
  expect(m.meta).toHaveBeenCalledWith(expect.any(String), 'https://graph.facebook.com/v26.0/123?fields=id,username', expect.objectContaining({ method: 'GET', cache: 'no-store', headers: { Authorization: 'Bearer facebook-secret' } }));
  expect(JSON.stringify(result)).not.toContain('facebook-secret');
  expect(m.list).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['123', '999'])('reports the actual publication owner %s without changing records', async owner => {
  setupInspection(); m.meta.mockResolvedValueOnce({ id: '222', owner: { id: owner } });
  const result = await inspectFacebookInstagramAction('product', 'publication');
  expect(result).toMatchObject({ success: true, publication: { id: '222', ownerId: owner, matches: owner === '123' } });
  expect(m.list).toHaveBeenCalledWith({ where: { id: 'publication', draft: { productId: 'product' }, platform: 'INSTAGRAM', status: 'PUBLISHED', deletedAt: null } });
  expect(m.update).not.toHaveBeenCalled(); expect(m.transaction).not.toHaveBeenCalled();
});
it('rejects missing or cross-product publications before contacting Meta', async () => {
  setupInspection(); m.list.mockResolvedValue([]);
  expect((await inspectFacebookInstagramAction('product', 'other')).success).toBe(false);
  expect(m.meta).not.toHaveBeenCalled();
});
it('requires authentication for inspection', async () => {
  setupInspection(); m.auth.mockResolvedValue(null);
  expect((await inspectFacebookInstagramAction('product')).success).toBe(false);
  expect(m.meta).not.toHaveBeenCalled();
});
it('rejects malformed inputs and missing Facebook configuration', async () => {
  expect((await inspectFacebookInstagramAction('product')).success).toBe(false);
  setupInspection();
  expect((await inspectFacebookInstagramAction('')).success).toBe(false);
  expect((await inspectFacebookInstagramAction('product', '')).success).toBe(false);
  expect(m.meta).not.toHaveBeenCalled();
});
it('rejects an unexpected account identity', async () => {
  setupInspection(); m.meta.mockReset().mockResolvedValue({ id: '999', username: 'other' });
  expect((await inspectFacebookInstagramAction('product')).success).toBe(false);
});
it.each([{}, { id: '222' }, { id: '999', owner: { id: '123' } }])('does not confirm incomplete or mismatched media responses', async media => {
  setupInspection(); m.meta.mockResolvedValueOnce(media);
  expect((await inspectFacebookInstagramAction('product', 'publication')).success).toBe(false);
});
it.each([190, 100, 10])('sanitizes provider errors (code %s)', async code => {
  setupInspection(); m.meta.mockReset().mockRejectedValue(new MetaApiError({ operation: 'read', message: 'facebook-secret', status: 400, error: { code } }));
  const result = await inspectFacebookInstagramAction('product');
  expect(result.success).toBe(false);
  expect(JSON.stringify(result)).not.toContain('facebook-secret');
  expect(m.update).not.toHaveBeenCalled();
});
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
it('persists the container and waits before calling media_publish', async () => {
  expect((await publishToInstagramAction(['product'])).success).toBe(true);
  expect(m.wait).toHaveBeenCalledWith('https://graph.instagram.com/v21.0', 'test-token', '111', expect.any(Number));
  expect(m.update.mock.invocationCallOrder[0]).toBeLessThan(m.wait.mock.invocationCallOrder[0]);
  expect(m.wait.mock.invocationCallOrder[0]).toBeLessThan(m.meta.mock.invocationCallOrder[1]);
});
it.each([true, false])('preserves pending containers but fails terminal processing errors (pending=%s)', async pending => {
  m.wait.mockRejectedValue(new InstagramContainerError('Processing result', pending));
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.meta).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: pending ? 'PROCESSING' : 'FAILED' }) }));
});
it('keeps the same container blocked if Meta still returns 9007 after FINISHED', async () => {
  m.meta.mockReset().mockResolvedValueOnce({ id: '111' }).mockRejectedValueOnce(new MetaApiError({ operation: 'publish', status: 400, message: 'Not ready', error: { code: 9007, error_subcode: 2207027 } }));
  expect((await publishToInstagramAction(['product'])).success).toBe(false);
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PROCESSING', lastErrorCode: 'RECONCILIATION_REQUIRED' }) }));
});
it('resumes a pending publication with the existing container instead of creating another', async () => {
  m.active.mockResolvedValue({
    id: 'publication', status: 'PROCESSING', externalContainerId: '111', externalMediaId: null,
    lastErrorCode: 'RECONCILIATION_REQUIRED', updatedAt: new Date(0),
  });
  m.containerStatus.mockResolvedValue('IN_PROGRESS');
  m.meta.mockReset().mockResolvedValueOnce({ id: '222' });
  expect(await resumeInstagramPublicationAction('product', 'publication')).toMatchObject({
    success: true, externalMediaId: '222',
  });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.wait).toHaveBeenCalledWith('https://graph.instagram.com/v21.0', 'test-token', '111', expect.any(Number));
  expect(m.meta).toHaveBeenCalledWith(
    'reintentar publicación del contenedor de Instagram',
    'https://graph.instagram.com/v21.0/123/media_publish',
    expect.objectContaining({ body: expect.any(URLSearchParams) }),
  );
  expect(m.meta.mock.calls[0][2].body.get('creation_id')).toBe('111');
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PUBLISHED', externalMediaId: '222' }) }));
});
it('reconciles a container that Meta reports as already published without publishing again', async () => {
  m.active.mockResolvedValue({
    id: 'publication', status: 'PROCESSING', externalContainerId: '111', externalMediaId: null,
    lastErrorCode: 'RECONCILIATION_REQUIRED', updatedAt: new Date(0),
  });
  m.containerStatus.mockResolvedValue('PUBLISHED');
  expect(await resumeInstagramPublicationAction('product', 'publication')).toMatchObject({ success: true, externalMediaId: null });
  expect(m.meta).not.toHaveBeenCalled();
  expect(m.wait).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
    status: 'PUBLISHED', lastErrorCode: 'PUBLISHED_ID_MISSING',
  }) }));
});
it('keeps the existing container pending when a resumed publish still returns 9007', async () => {
  m.active.mockResolvedValue({
    id: 'publication', status: 'PROCESSING', externalContainerId: '111', externalMediaId: null,
    lastErrorCode: 'RECONCILIATION_REQUIRED', updatedAt: new Date(0),
  });
  m.meta.mockReset().mockRejectedValueOnce(new MetaApiError({
    operation: 'publish', status: 400, message: 'Not ready', error: { code: 9007, error_subcode: 2207027 },
  }));
  expect(await resumeInstagramPublicationAction('product', 'publication')).toMatchObject({ success: false });
  expect(m.create).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
    status: 'PROCESSING', lastErrorCode: 'RECONCILIATION_REQUIRED',
  }) }));
});
