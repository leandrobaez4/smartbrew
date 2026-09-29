import { describe, expect, it } from 'vitest';
import { supplierSnapshotFreshness, supplierSourceUrl } from './supplier-snapshot-freshness';

const now = new Date('2026-09-29T18:00:00.000Z');

describe('supplier snapshot freshness', () => {
  it.each([
    [2, 'RECENT'],
    [30, 'EXPIRING'],
    [80, 'EXPIRED'],
  ])('maps a snapshot %s hours old to %s', (hours, status) => {
    expect(supplierSnapshotFreshness({
      verifiedAt: new Date(now.getTime() - hours * 3_600_000),
      freshHours: 24,
      expiredHours: 72,
      now,
    }).status).toBe(status);
  });

  it('requires review when the manual observation is newer than Mercado Libre', () => {
    expect(supplierSnapshotFreshness({
      verifiedAt: new Date('2026-09-29T17:00:00.000Z'),
      marketplaceSyncedAt: new Date('2026-09-29T16:00:00.000Z'),
      listingStatus: 'ACTIVE',
      stock: 0,
      freshHours: 24,
      expiredHours: 72,
      now,
    })).toMatchObject({ status: 'REVIEW_REQUIRED', canPublish: true });
  });

  it('accepts only HTTPS Unidrop product URLs', () => {
    expect(supplierSourceUrl({ sourceUrl: 'https://www.unidrop.com.ar/panel/catalogue/398' })).toContain('/panel/catalogue/398');
    expect(supplierSourceUrl({ sourceUrl: 'https://example.com/398' })).toBeNull();
  });
});
