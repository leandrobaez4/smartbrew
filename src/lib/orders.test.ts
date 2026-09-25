import { describe, expect, it } from 'vitest';
import { orderFinancials } from './orders';

describe('orderFinancials', () => {
  it('calculates the supplier total and realized margin', () => {
    expect(orderFinancials({ salePrice: 10_000, supplierCost: 3_000, quantity: 2, profit: 4_000 })).toEqual({
      supplierTotal: 6_000,
      marginPercentage: 40,
    });
  });

  it('rejects invalid quantities and non-finite values', () => {
    expect(() => orderFinancials({ salePrice: 10, supplierCost: 2, quantity: 0, profit: 8 })).toThrow();
    expect(() => orderFinancials({ salePrice: Number.NaN, supplierCost: 2, quantity: 1, profit: 8 })).toThrow();
  });
});
