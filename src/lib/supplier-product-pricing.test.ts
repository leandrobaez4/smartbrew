import { describe, expect, it } from 'vitest';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from './supplier-product-pricing';

describe('supplier product pricing', () => {
  const input = {
    supplierPriceUsd: 100,
    exchangeRateArsPerUsd: 1_535,
    vatPercentage: 21,
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
      exchangeRateArsPerUsd: 1_535,
      supplierPriceArs: 153_500,
      vatPercentage: 21,
      vatAmountUsd: 21,
      vatAmountArs: 32_235,
      supplierCostWithVatUsd: 121,
      supplierCostWithVatArs: 185_735,
      productSearchCostArs: 2_000,
      shippingCostArs: 8_000,
      marketplaceFeePercentage: 13,
      marketplaceFixedFeeArs: 500,
      marketplaceFeeAmountArs: 35_686.97,
      marketplaceCategoryId: 'MLA1234',
      marketplaceListingTypeId: 'gold_special',
      targetMarginPercentage: 20,
      targetProfitArs: 39_247,
      totalCostArs: 231_421.97,
      finalPriceArs: 270_668.97,
    });
  });

  it('rejects impossible rates and commission percentages', () => {
    expect(SupplierProductPricingSchema.safeParse({ ...input, exchangeRateArsPerUsd: 0 }).success).toBe(false);
    expect(SupplierProductPricingSchema.safeParse({ ...input, marketplaceFeePercentage: 100 }).success).toBe(false);
  });
});
