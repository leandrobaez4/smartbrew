import { describe, expect, it } from 'vitest';
import { normalizeAdminReturnTo } from './admin-return-to';

describe('normalizeAdminReturnTo', () => {
  it('accepts internal admin destinations', () => {
    expect(normalizeAdminReturnTo('/admin/suppliers/elit-import?payload=abc_123')).toBe('/admin/suppliers/elit-import?payload=abc_123');
    expect(normalizeAdminReturnTo('/admin/opportunities/123')).toBe('/admin/opportunities/123');
  });

  it.each([
    'https://evil.example/admin/products',
    '//evil.example/admin/products',
    '/admin/login',
    '/portal/login',
    '/dashboard/opportunities',
    '/admin\\evil.example',
  ])('rejects unsafe destination %s', (destination) => {
    expect(normalizeAdminReturnTo(destination)).toBeNull();
  });
});
