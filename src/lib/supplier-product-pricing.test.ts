import { describe, expect, it } from 'vitest';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from './supplier-product-pricing';

describe('supplier product pricing', () => {
  const input = {
    supplierPriceUsd: 100,
    supplierCurrency: 'USD' as const,
    supplierPriceArs: 0,
    exchangeRateArsPerUsd: 1_535,
    vatTreatment: 'EXCLUDED' as const,
    vatPercentage: 21,
    internalTaxAmountUsd: 5,
    internalTaxAmountArs: 0,
    supplierPvpUsd: 140,
    supplierPvpArs: 214_900,
    supplierMarkupPercentage: 15,
    productSearchCostArs: 2_000,
    shippingCostArs: 8_000,
    marketplaceFeePercentage: 13,
    marketplaceFixedFeeArs: 500,
    marketplaceCategoryId: 'MLA1234',
    marketplaceListingTypeId: 'gold_special' as const,
    targetMarginPercentage: 20,
  };

  it('keeps USD, ARS and VAT amounts and solves percentage costs against the final price', () => {
    expect(calculateSupplierProductPricing(input)).toEqual({
      supplierPriceUsd: 100,
      supplierCurrency: 'USD',
      exchangeRateArsPerUsd: 1_535,
      supplierPriceArs: 153_500,
      vatPercentage: 21,
      vatAmountUsd: 21,
      vatAmountArs: 32_235,
      supplierCostWithVatUsd: 121,
      supplierCostWithVatArs: 185_735,
      internalTaxAmountUsd: 5,
      internalTaxAmountArs: 7_675,
      supplierCostWithTaxesUsd: 126,
      supplierCostWithTaxesArs: 193_410,
      supplierPvpUsd: 140,
      supplierPvpArs: 214_900,
      supplierMarkupPercentage: 15,
      productSearchCostArs: 2_000,
      shippingCostArs: 8_000,
      marketplaceFeePercentage: 13,
      marketplaceFixedFeeArs: 500,
      marketplaceFeeAmountArs: 40_064.63,
      marketplaceCategoryId: 'MLA1234',
      marketplaceListingTypeId: 'gold_special',
      targetMarginPercentage: 20,
      targetProfitArs: 60_868.66,
      netMarginPercentage: 20,
      roiPercentage: 25,
      totalCostArs: 243_474.63,
      finalPriceArs: 304_343.29,
    });
  });

  it('rejects impossible rates and commission percentages', () => {
    expect(SupplierProductPricingSchema.safeParse({ ...input, exchangeRateArsPerUsd: 0 }).success).toBe(false);
    expect(SupplierProductPricingSchema.safeParse({ ...input, marketplaceFeePercentage: 100 }).success).toBe(false);
    expect(SupplierProductPricingSchema.safeParse({ ...input, marketplaceFeePercentage: 30, targetMarginPercentage: 70 }).success).toBe(false);
  });

  it('keeps supplier PVP as a reference instead of using it to set the publication price', () => {
    const lowReference = calculateSupplierProductPricing({ ...input, supplierPvpUsd: 110, supplierPvpArs: 168_850 });
    const highReference = calculateSupplierProductPricing({ ...input, supplierPvpUsd: 250, supplierPvpArs: 383_750 });

    expect(lowReference.finalPriceArs).toBe(highReference.finalPriceArs);
    expect(lowReference.supplierPvpArs).toBe(168_850);
    expect(highReference.supplierPvpArs).toBe(383_750);
  });

  it('calculates ARS costs without requiring a USD exchange rate', () => {
    const result = calculateSupplierProductPricing({
      ...input,
      supplierCurrency: 'ARS',
      supplierPriceUsd: 0,
      supplierPriceArs: 14_169,
      exchangeRateArsPerUsd: 0,
      vatTreatment: 'INCLUDED',
      internalTaxAmountUsd: 0,
      internalTaxAmountArs: 1_000,
      supplierPvpUsd: 0,
      supplierPvpArs: 18_000,
    });

    expect(result).toMatchObject({
      supplierCurrency: 'ARS',
      supplierPriceUsd: 0,
      supplierPriceArs: 14_169,
      vatAmountUsd: 0,
      vatAmountArs: 2_459.08,
      supplierCostWithVatArs: 14_169,
      internalTaxAmountArs: 1_000,
      supplierCostWithTaxesArs: 15_169,
      supplierPvpArs: 18_000,
    });
  });

  it('keeps unknown VAT out of the cost instead of inventing a tax amount', () => {
    const result = calculateSupplierProductPricing({
      ...input,
      supplierCurrency: 'ARS',
      supplierPriceUsd: 0,
      supplierPriceArs: 14_169,
      exchangeRateArsPerUsd: 0,
      vatTreatment: 'UNKNOWN',
      internalTaxAmountUsd: 0,
      internalTaxAmountArs: 0,
    });

    expect(result.vatAmountArs).toBe(0);
    expect(result.vatPercentage).toBe(0);
    expect(result.supplierCostWithVatArs).toBe(14_169);
  });
});
