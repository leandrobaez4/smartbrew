import { describe, expect, it } from 'vitest';
import { calculateProductScore, DEFAULT_PRODUCT_SCORE_WEIGHTS } from './product-scoring';

const input = {
  profitMargin: 20, roi: 40, stock: 10, currentCost: 100,
  costHistory: [100, 100], supplierActive: true, supplierLastSyncAt: new Date(), orderCount: 5,
};

describe('product scoring', () => {
  it('returns a bounded 0-100 score and transparent factor values', () => {
    const result = calculateProductScore(input);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors).toMatchObject({ profitMargin: 50, roi: 50, stock: 50, priceStability: 100, marketplaceDemand: 50 });
    expect(result.estimatedFactors).toEqual(['competition']);
  });

  it('marks price stability as estimated without enough history', () => {
    expect(calculateProductScore({ ...input, costHistory: [] }).estimatedFactors).toEqual(['priceStability', 'competition']);
  });

  it('penalizes unstable prices and uses known competition when provided', () => {
    const stable = calculateProductScore(input);
    const unstable = calculateProductScore({ ...input, costHistory: [50, 150], competitorCount: 8 });
    expect(unstable.score).toBeLessThan(stable.score);
    expect(unstable.estimatedFactors).not.toContain('competition');
  });

  it('accepts future configurable weights and validates them', () => {
    const weights = { ...DEFAULT_PRODUCT_SCORE_WEIGHTS, profitMargin: 100, roi: 0, stock: 0, priceStability: 0, supplierStability: 0, marketplaceDemand: 0, competition: 0 };
    expect(calculateProductScore(input, weights).score).toBe(50);
    expect(() => calculateProductScore(input, { ...weights, profitMargin: 0 })).toThrow('weights');
  });
});
