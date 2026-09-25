import { describe, expect, it } from 'vitest';
import { normalizeAdminReturnTo } from './admin-return-to';

describe('normalizeAdminReturnTo', () => {
  it('accepts internal admin and dashboard destinations', () => {
    expect(normalizeAdminReturnTo('/admin/suppliers/elit-import?payload=abc_123')).toBe('/admin/suppliers/elit-import?payload=abc_123');
    expect(normalizeAdminReturnTo('/dashboard/opportunities/123')).toBe('/dashboard/opportunities/123');
  });

  it.each([
    'https://evil.example/admin/products',
    '//evil.example/admin/products',
    '/admin/login',
    '/portal/login',
    '/admin\\evil.example',
  ])('rejects unsafe destination %s', (destination) => {
    expect(normalizeAdminReturnTo(destination)).toBeNull();
  });
});
