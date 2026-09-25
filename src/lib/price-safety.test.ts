import { describe, expect, it } from 'vitest';
import { PriceSafetyRules } from './price-safety';

const rules = new PriceSafetyRules({ maximumPriceChangePercentage: 40, minimumPrice: 500, maximumPrice: 50_000 });

describe('PriceSafetyRules', () => {
  it('accepts a price inside every configured boundary', () => {
    expect(rules.evaluate(10_000, 8_000)).toEqual({ safe: true, changePercentage: 20, reasons: [] });
  });

  it('detects a catastrophic price drop', () => {
    expect(rules.evaluate(30_000, 300)).toEqual({
      safe: false,
      changePercentage: 99,
      reasons: ['CHANGE_PERCENTAGE', 'BELOW_MINIMUM'],
    });
  });

  it('enforces the configured maximum price', () => {
    expect(rules.evaluate(40_000, 55_000)).toMatchObject({ safe: false, reasons: ['ABOVE_MAXIMUM'] });
  });

  it('rejects invalid configuration and input', () => {
    expect(() => new PriceSafetyRules({ maximumPriceChangePercentage: 10, minimumPrice: 100, maximumPrice: 10 })).toThrow();
    expect(() => rules.evaluate(0, 100)).toThrow();
  });
});
