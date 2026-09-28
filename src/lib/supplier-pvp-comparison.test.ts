import { describe, expect, it } from 'vitest';
import { compareSupplierPvp, resolveSupplierPvpArs } from './supplier-pvp-comparison';

describe('supplier PVP comparison', () => {
  it('prefers the ARS reference supplied by the provider', () => {
    expect(resolveSupplierPvpArs({
      supplierPvpArs: 150_000,
      supplierPvpUsd: 100,
      exchangeRateArsPerUsd: 1_400,
    })).toBe(150_000);
  });

  it('converts the USD reference when the ARS value is unavailable', () => {
    expect(resolveSupplierPvpArs({ supplierPvpUsd: 10.77, exchangeRateArsPerUsd: 1_535 })).toBe(16_531.95);
  });

  it('compares our published price against the supplier PVP', () => {
    expect(compareSupplierPvp(100_000, 120_000)).toEqual({
      supplierPvpArs: 100_000,
      publishedPriceArs: 120_000,
      differenceArs: 20_000,
      differencePercentage: 20,
      position: 'ABOVE',
    });
    expect(compareSupplierPvp(100_000, 90_000)?.position).toBe('BELOW');
    expect(compareSupplierPvp(100_000, 100_000)?.position).toBe('EQUAL');
  });

  it('does not compare missing or invalid prices', () => {
    expect(compareSupplierPvp(null, 100_000)).toBeNull();
    expect(compareSupplierPvp(100_000, null)).toBeNull();
    expect(compareSupplierPvp(0, 100_000)).toBeNull();
  });
});
