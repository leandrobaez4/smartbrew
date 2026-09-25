import { describe, expect, it } from 'vitest';
import { ProfitabilityService } from './profitability';

describe('ProfitabilityService', () => {
  const service = new ProfitabilityService({
    minimumProfitPercentage: 20,
    minimumProfitAmount: 1_000,
  });

  it('calculates gross profit, net profit, margin and ROI', () => {
    expect(service.calculate({
      supplierCost: 5_000,
      marketplacePrice: 10_000,
      marketplaceFee: 1_000,
      shippingCost: 500,
      taxes: 500,
      extraCosts: 0,
    })).toEqual({
      grossProfit: 5_000,
      netProfit: 3_000,
      marginPercentage: 30,
      roi: 42.86,
      recommendedPrice: 8_750,
      meetsMinimumProfitability: true,
    });
  });

  it('recommends the strictest price required by amount or margin', () => {
    const amountLimited = new ProfitabilityService({ minimumProfitPercentage: 5, minimumProfitAmount: 2_000 });
    expect(amountLimited.calculate({
      supplierCost: 5_000,
      marketplacePrice: 6_000,
      marketplaceFee: 0,
      shippingCost: 0,
      taxes: 0,
      extraCosts: 0,
    })).toMatchObject({ recommendedPrice: 7_000, meetsMinimumProfitability: false });

    expect(service.calculate({
      supplierCost: 5_000,
      marketplacePrice: 8_750,
      marketplaceFee: 1_000,
      shippingCost: 500,
      taxes: 500,
      extraCosts: 0,
    })).toMatchObject({ recommendedPrice: 8_750, meetsMinimumProfitability: true });
  });

  it('detects a negative margin and never marks it as profitable', () => {
    expect(service.calculate({
      supplierCost: 9_000,
      marketplacePrice: 10_000,
      marketplaceFee: 1_000,
      shippingCost: 500,
      taxes: 500,
      extraCosts: 0,
    })).toMatchObject({
      netProfit: -1_000,
      marginPercentage: -10,
      meetsMinimumProfitability: false,
    });
  });

  it('rejects invalid monetary inputs and impossible configuration', () => {
    expect(() => service.calculate({
      supplierCost: -1,
      marketplacePrice: 100,
      marketplaceFee: 0,
      shippingCost: 0,
      taxes: 0,
      extraCosts: 0,
    })).toThrow('supplierCost');
    expect(() => service.calculate({
      supplierCost: 0,
      marketplacePrice: 0,
      marketplaceFee: 0,
      shippingCost: 0,
      taxes: 0,
      extraCosts: 0,
    })).toThrow('marketplacePrice');
    expect(() => new ProfitabilityService({ minimumProfitPercentage: 100, minimumProfitAmount: 0 })).toThrow('lower than 100');
  });
});
