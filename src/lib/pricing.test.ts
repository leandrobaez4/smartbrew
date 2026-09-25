import { describe, expect, it } from 'vitest';
import { PricingService } from './pricing';

describe('PricingService', () => {
  const costs = {
    supplierCost: 5_000,
    marketplaceFee: 1_000,
    shippingCost: 500,
    taxes: 500,
    extraCosts: 0,
  };

  it('calculates a recommended price from every marketplace cost', () => {
    const result = new PricingService({ minimumMarginPercentage: 20 }).calculate({
      ...costs,
      targetMarginPercentage: 20,
    });
    expect(result).toEqual({
      recommendedPrice: 8_750,
      appliedMarginPercentage: 20,
      netProfit: 1_750,
      marginPercentage: 20,
      roi: 25,
    });
  });

  it('enforces the configured minimum above a lower target margin', () => {
    const result = new PricingService({ minimumMarginPercentage: 25 }).calculate({
      ...costs,
      targetMarginPercentage: 10,
    });
    expect(result.recommendedPrice).toBe(9_333.34);
    expect(result.appliedMarginPercentage).toBe(25);
    expect(result.marginPercentage).toBeGreaterThanOrEqual(25);
    expect(result.netProfit).toBeGreaterThan(0);
  });

  it('uses the stricter configured minimum amount and never returns a loss', () => {
    const result = new PricingService({ minimumMarginPercentage: 5, minimumProfitAmount: 2_000 }).calculate({
      ...costs,
      targetMarginPercentage: 10,
    });
    expect(result.recommendedPrice).toBe(9_000);
    expect(result.netProfit).toBe(2_000);
    expect(result.netProfit).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid costs and impossible margins', () => {
    const service = new PricingService({ minimumMarginPercentage: 20 });
    expect(() => service.calculate({ ...costs, supplierCost: -1, targetMarginPercentage: 20 })).toThrow('supplierCost');
    expect(() => service.calculate({ ...costs, targetMarginPercentage: 100 })).toThrow('targetMarginPercentage');
    expect(() => new PricingService({ minimumMarginPercentage: 100 })).toThrow('minimumMarginPercentage');
  });
});
