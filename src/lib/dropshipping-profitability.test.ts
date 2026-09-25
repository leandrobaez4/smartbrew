import { describe, expect, it } from 'vitest';
import { aggregateProfitability, parseProfitabilityGroup, type ProfitabilityRow } from './dropshipping-profitability';

function row(overrides: Partial<ProfitabilityRow> = {}): ProfitabilityRow {
  return {
    salePrice: 10_000, quantity: 2, supplierCost: 3_000, marketplaceFee: 500,
    shippingCost: 300, taxes: 200, financialsEstimated: true,
    orderedAt: new Date('2026-09-24T12:00:00Z'), createdAt: new Date('2026-09-24T12:00:00Z'),
    supplier: { id: 'supplier-1', name: 'Proveedor Uno' },
    supplierProduct: { id: 'product-1', title: 'Cafetera', category: 'Cocina' },
    ...overrides,
  };
}

describe('dropshipping profitability', () => {
  it('calculates every financial metric from immutable order snapshots', () => {
    expect(aggregateProfitability([row()], 'product')).toEqual([expect.objectContaining({
      label: 'Cafetera', orders: 1, revenue: 10_000, supplierCost: 6_000,
      marketplaceFees: 500, shipping: 300, taxes: 200, netProfit: 3_000,
      margin: 30, roi: 42.86, estimated: true,
    })]);
  });

  it('groups by supplier and explicitly preserves real versus estimated state', () => {
    const metrics = aggregateProfitability([
      row({ financialsEstimated: false }),
      row({ supplierProduct: { id: 'product-2', title: 'Tostadora', category: 'Cocina' }, financialsEstimated: false }),
    ], 'supplier');
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ label: 'Proveedor Uno', orders: 2, estimated: false, netProfit: 6_000 });
  });

  it.each([
    ['category', 'Cocina'], ['day', '2026-09-24'], ['week', '2026-W39'], ['month', '2026-09'],
  ] as const)('groups by %s', (group, expected) => {
    expect(aggregateProfitability([row()], group)[0].key).toBe(expected);
  });

  it('falls back to product for invalid grouping input', () => {
    expect(parseProfitabilityGroup('invalid')).toBe('product');
  });
});
