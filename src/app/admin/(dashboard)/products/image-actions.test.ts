import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), lock: vi.fn(), find: vi.fn(), job: vi.fn(), publication: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: m.auth }));
vi.mock('next/cache', () => ({ revalidatePath: m.refresh }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  async $transaction(fn: (tx: unknown) => unknown) {
    return fn({ $queryRaw: m.lock, product: { findUnique: m.find, update: m.update }, jobExecution: { findFirst: m.job }, publication: { findFirst: m.publication } });
  }
} }));
import { removeProductImageAction } from './image-actions';
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue({ primaryImageUrl: 'a', imageUrls: ['a', 'b', 'c'] });
});
it('promotes the next image and refreshes both admin and public views', async () => {
  expect((await removeProductImageAction('product', 'a')).success).toBe(true);
  expect(m.lock).toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product' }, data: { primaryImageUrl: 'b', imageUrls: ['b', 'c'] } });
  expect(m.refresh).toHaveBeenCalledWith('/productos/product');
  expect(m.refresh).toHaveBeenCalledWith('/admin/products');
});
it('keeps the cover when removing a secondary image', async () => {
  await removeProductImageAction('product', 'b');
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product' }, data: { primaryImageUrl: 'a', imageUrls: ['a', 'c'] } });
});
it('allows removing the last image without leaving a stale cover', async () => {
  m.find.mockResolvedValue({ primaryImageUrl: 'a', imageUrls: ['a'] });
  await removeProductImageAction('product', 'a');
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product' }, data: { primaryImageUrl: null, imageUrls: [] } });
});
it('removes duplicate resolutions of a Mercado Libre photo', async () => {
  const cover = 'https://http2.mlstatic.com/D_NQ_NP_123456-MLA123456789_092026-O.webp';
  m.find.mockResolvedValue({ primaryImageUrl: cover, imageUrls: [cover.replace('-O.webp', '-F.webp'), 'b'] });
  await removeProductImageAction('product', cover);
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product' }, data: { primaryImageUrl: 'b', imageUrls: ['b'] } });
});
it('rejects unauthorized changes', async () => {
  m.auth.mockRejectedValue(Error('unauthorized'));
  expect((await removeProductImageAction('product', 'a')).success).toBe(false);
  expect(m.lock).not.toHaveBeenCalled();
});
it('blocks queued work and in-flight publications', async () => {
  m.job.mockResolvedValue({ id: 'job' });
  expect((await removeProductImageAction('product', 'a')).success).toBe(false);
  m.job.mockResolvedValue(null);
  m.publication.mockResolvedValue({ id: 'pub' });
  expect((await removeProductImageAction('product', 'a')).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('rejects invalid inputs and stale or unknown images', async () => {
  expect((await removeProductImageAction('../bad', 'a')).success).toBe(false);
  expect((await removeProductImageAction('product', 'other')).success).toBe(false);
  m.find.mockResolvedValue(null);
  expect((await removeProductImageAction('missing', 'a')).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('reports database failures without claiming success', async () => {
  m.update.mockRejectedValue(Error('database error'));
  expect((await removeProductImageAction('product', 'a')).success).toBe(false);
  expect(m.refresh).not.toHaveBeenCalled();
});
