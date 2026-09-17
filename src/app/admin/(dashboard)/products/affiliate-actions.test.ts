import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: m.auth }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { product = { update: m.update }; } }));
vi.mock('next/cache', () => ({ revalidatePath: m.refresh }));
import { updateAffiliateUrlAction } from './affiliate-actions';
beforeEach(() => { vi.resetAllMocks(); });
function data(url = 'https://meli.la/test', confirmed = true) {
  const form = new FormData();
  form.set('affiliateUrl', url);
  if (confirmed) form.set('confirmed', 'on');
  return form;
}
it('saves from either view and refreshes list and detail', async () => {
  expect((await updateAffiliateUrlAction('product', data())).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'product' }, data: { affiliateUrl: 'https://meli.la/test', status: 'ACTIVE' } });
  expect(m.refresh).toHaveBeenCalledWith('/admin/products');
  expect(m.refresh).toHaveBeenCalledWith('/admin/products/product');
});
it('rejects unauthenticated changes', async () => {
  m.auth.mockRejectedValue(new Error('Unauthorized'));
  expect((await updateAffiliateUrlAction('product', data())).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('requires confirmation and a safe URL', async () => {
  for (const form of [data('javascript:alert(1)'), data('https://meli.la/test', false), data('invalid')]) {
    expect((await updateAffiliateUrlAction('product', form)).success).toBe(false);
  }
  expect(m.update).not.toHaveBeenCalled();
});
