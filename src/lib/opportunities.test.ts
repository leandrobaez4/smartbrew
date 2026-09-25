import { describe, expect, it } from 'vitest';
import { calculateOpportunities, OpportunityConfig, OpportunityProduct } from './opportunities';

const config: OpportunityConfig = {
  marketplaceFee: 1_000,
  shippingCost: 500,
  taxes: 500,
  extraCosts: 0,
  targetMarginPercentage: 20,
  minimumMarginPercentage: 20,
  minimumProfitAmount: 0,
};
const product = (overrides: Partial<OpportunityProduct> = {}): OpportunityProduct => ({
  id: 'product-1', title: 'Producto', category: 'Tecnología', cost: 5_000, currency: 'ARS', stock: 3, active: true,
  supplier: { id: 'supplier-1', name: 'Proveedor', status: 'ACTIVE' }, listings: [], ...overrides,
});

describe('opportunity dashboard data', () => {
  it('includes configured products even when stock is zero or unavailable', () => {
    const rows = calculateOpportunities([
      product(),
      product({ id: 'zero-stock', stock: 0 }),
      product({ id: 'unknown-stock', stock: null }),
      product({ id: 'inactive', supplier: { id: 'supplier-2', name: 'Inactivo', status: 'INACTIVE' } }),
    ], config);
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.id === 'product-1')).toMatchObject({ recommendedPrice: 8_750, estimatedProfit: 1_750, marginPercentage: 20, roi: 25, stockReported: true });
    expect(rows.find((row) => row.id === 'unknown-stock')).toMatchObject({ stock: 0, stockReported: false });
  });

  it('can explicitly filter out products without available stock', () => {
    const rows = calculateOpportunities([
      product(),
      product({ id: 'zero-stock', stock: 0 }),
      product({ id: 'unknown-stock', stock: null }),
    ], config, { minimumStock: 1 });
    expect(rows.map((row) => row.id)).toEqual(['product-1']);
  });

  it('filters by supplier, category, margin, maximum cost and minimum stock', () => {
    const rows = calculateOpportunities([
      product(),
      product({ id: 'other', category: 'Café', cost: 2_000, stock: 10 }),
    ], config, { supplierId: 'supplier-1', category: 'Café', minimumMargin: 20, maximumCost: 3_000, minimumStock: 5 });
    expect(rows.map((row) => row.id)).toEqual(['other']);
  });

  it.each([
    ['score', 'cheap'],
    ['margin', 'cheap'],
    ['roi', 'cheap'],
    ['profit', 'expensive'],
    ['cost', 'cheap'],
  ] as const)('sorts by %s', (sort, first) => {
    const rows = calculateOpportunities([
      product({ id: 'expensive', cost: 8_000 }),
      product({ id: 'cheap', cost: 2_000 }),
    ], { ...config, minimumProfitAmount: 2_000 }, { sort });
    expect(rows[0].id).toBe(first);
  });

  it('exposes a score and identifies factors that lack marketplace evidence', () => {
    const rows = calculateOpportunities([product({
      history: [{ cost: 5_000 }, { cost: 5_000 }], orderCount: 4,
      supplier: { id: 'supplier-1', name: 'Proveedor', status: 'ACTIVE', lastSyncAt: new Date() },
    })], config, { sort: 'score' });
    expect(rows[0].productScore).toBeGreaterThanOrEqual(0);
    expect(rows[0].productScore).toBeLessThanOrEqual(100);
    expect(rows[0].estimatedScoreFactors).toEqual(['competition']);
  });
});
