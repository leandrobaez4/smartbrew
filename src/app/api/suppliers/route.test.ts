import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorized: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  parse: vi.fn(),
}));

vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/suppliers', () => ({ createSupplier: mocks.create, listSuppliers: mocks.list }));
vi.mock('@/lib/supplier-form', () => ({ parseSupplierInput: mocks.parse }));

import { GET, POST } from './route';

describe('/api/suppliers', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rejects unauthenticated reads and writes', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await GET()).status).toBe(401);
    expect((await POST(new Request('http://localhost/api/suppliers', { method: 'POST', body: '{}' }))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns redacted supplier responses from the service', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.list.mockResolvedValue([{ id: 'supplier-1', credentialsConfigured: { apiKey: true } }]);
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ suppliers: [{ id: 'supplier-1', credentialsConfigured: { apiKey: true } }] });
  });

  it('validates input and applies defaults before creation', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.create.mockResolvedValue({ id: 'supplier-1', name: 'Proveedor Uno' });
    mocks.parse
      .mockReturnValueOnce({ success: false, error: { issues: [{ message: 'Usá un slug válido.' }] } })
      .mockReturnValueOnce({ success: true, data: { name: 'Proveedor Uno', slug: 'proveedor-uno', integrationType: 'MANUAL', status: 'ACTIVE' } });

    const invalid = await POST(new Request('http://localhost/api/suppliers', { method: 'POST', body: JSON.stringify({ name: 'X', slug: 'INVALID SLUG' }) }));
    expect(invalid.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();

    const valid = await POST(new Request('http://localhost/api/suppliers', { method: 'POST', body: JSON.stringify({ name: 'Proveedor Uno', slug: 'proveedor-uno' }) }));
    expect(valid.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ integrationType: 'MANUAL', status: 'ACTIVE' }));
  });
});
