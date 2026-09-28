import { describe, expect, it } from 'vitest';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from './supplier-product-pricing';

describe('supplier product pricing', () => {
  const input = {
    supplierPriceUsd: 100,
    supplierCurrency: 'USD' as const,
    exchangeRateArsPerUsd: 1_535,
    vatPercentage: 21,
    internalTaxAmountUsd: 5,
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
      marketplaceFeeAmountArs: 37_063.17,
      marketplaceCategoryId: 'MLA1234',
      marketplaceListingTypeId: 'gold_special',
      targetMarginPercentage: 20,
      targetProfitArs: 40_782,
      totalCostArs: 240_473.17,
      finalPriceArs: 281_255.18,
    });
  });

  it('rejects impossible rates and commission percentages', () => {
    expect(SupplierProductPricingSchema.safeParse({ ...input, exchangeRateArsPerUsd: 0 }).success).toBe(false);
    expect(SupplierProductPricingSchema.safeParse({ ...input, marketplaceFeePercentage: 100 }).success).toBe(false);
  });

  it('keeps supplier PVP as a reference instead of using it to set the publication price', () => {
    const lowReference = calculateSupplierProductPricing({ ...input, supplierPvpUsd: 110, supplierPvpArs: 168_850 });
    const highReference = calculateSupplierProductPricing({ ...input, supplierPvpUsd: 250, supplierPvpArs: 383_750 });

    expect(lowReference.finalPriceArs).toBe(highReference.finalPriceArs);
    expect(lowReference.supplierPvpArs).toBe(168_850);
    expect(highReference.supplierPvpArs).toBe(383_750);
  });
});
