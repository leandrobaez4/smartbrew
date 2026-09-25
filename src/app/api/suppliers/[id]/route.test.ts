import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  parse: vi.fn(),
}));

vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/suppliers', () => ({ getSupplier: mocks.get, removeSupplier: mocks.remove, updateSupplier: mocks.update }));
vi.mock('@/lib/supplier-form', () => ({ parseSupplierInput: mocks.parse }));

import { DELETE, GET, PUT } from './route';

const context = (id = 'supplier-1') => ({ params: Promise.resolve({ id }) });

describe('/api/suppliers/[id]', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rejects unauthenticated and malformed identifiers', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await GET(new Request('http://localhost'), context()))?.status).toBe(401);

    mocks.authorized.mockResolvedValue(true);
    expect((await GET(new Request('http://localhost'), context('../invalid')))?.status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('returns 404 for missing suppliers', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.get.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost'), context()))?.status).toBe(404);
  });

  it('updates and deletes an existing supplier', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.update.mockResolvedValue({ id: 'supplier-1', name: 'Proveedor Editado' });
    mocks.parse.mockReturnValue({ success: true, data: { name: 'Proveedor Editado', slug: 'proveedor-editado', integrationType: 'MANUAL', status: 'ACTIVE' } });
    const request = new Request('http://localhost/api/suppliers/supplier-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Proveedor Editado', slug: 'proveedor-editado' }),
    });

    expect((await PUT(request, context()))?.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith('supplier-1', expect.objectContaining({ name: 'Proveedor Editado' }));
    expect((await DELETE(new Request('http://localhost'), context()))?.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith('supplier-1');
  });
});
