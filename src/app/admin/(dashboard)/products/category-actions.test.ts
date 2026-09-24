import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), generate: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: m.auth }));
vi.mock('next/cache', () => ({ revalidatePath: m.refresh }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { product = { findUnique: m.find, updateMany: m.update }; } }));
vi.mock('../../../../lib/product-editorial', () => ({ generateProductEditorial: m.generate, stringAttributes: (value: unknown) => value }));
import { recalculateProductCategory } from './category-actions';
const updatedAt = new Date('2026-09-23');
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue({ title: 'Cafetera', originalTitle: 'Cafetera original', originalDescription: 'Descripción original', categoryId: 'MLA1', attributesJson: { BRAND: 'Marca' }, updatedAt, aiStatus: 'COMPLETED' });
  m.generate.mockResolvedValue({ suggestedCategory: 'cafe', displayTitle: 'No reemplazar' });
  m.update.mockResolvedValue({ count: 1 });
});
it('reuses original inputs and saves only the category with concurrency protection', async () => {
  expect((await recalculateProductCategory('product')).success).toBe(true);
  expect(m.generate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cafetera original', description: 'Descripción original', category: 'MLA1', brand: 'Marca' }));
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product', updatedAt }, data: { category: 'cafe' } });
  expect(m.refresh).toHaveBeenCalledWith('/productos');
});
it('rejects unauthorized requests', async () => {
  m.auth.mockRejectedValue(Error('unauthorized'));
  expect((await recalculateProductCategory('product')).success).toBe(false);
  expect(m.generate).not.toHaveBeenCalled();
});
it('does not overwrite on AI failure or an invalid category', async () => {
  m.generate.mockRejectedValueOnce(Error('failure'));
  expect((await recalculateProductCategory('product')).success).toBe(false);
  m.generate.mockResolvedValue({ suggestedCategory: 'inventada' });
  expect((await recalculateProductCategory('product')).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('reports concurrent edits rather than claiming success', async () => {
  m.update.mockResolvedValue({ count: 0 });
  expect((await recalculateProductCategory('product')).success).toBe(false);
  expect(m.refresh).not.toHaveBeenCalled();
});
it('rejects missing products, invalid IDs and an active editorial generation', async () => {
  expect((await recalculateProductCategory('../bad')).success).toBe(false);
  m.find.mockResolvedValueOnce(null);
  expect((await recalculateProductCategory('product')).success).toBe(false);
  m.find.mockResolvedValueOnce({ aiStatus: 'PROCESSING' });
  expect((await recalculateProductCategory('product')).success).toBe(false);
  expect(m.generate).not.toHaveBeenCalled();
});
