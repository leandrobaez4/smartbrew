import { describe, expect, it, vi } from 'vitest';
import { quoteSupplierProductShipping } from './supplier-shipping-quote';

const pricing = {
  supplierCostWithTaxesArs: 10_000,
  marketplaceFeePercentage: 10,
  marketplaceFixedFeeArs: 500,
  productSearchCostArs: 1_000,
  targetMarginPercentage: 20,
  finalPriceArs: 16_428.58,
  marketplaceListingTypeId: 'gold_special',
};

describe('supplier shipping quote', () => {
  it('requotes with the shipping-adjusted price and returns final profitability', async () => {
    const quote = vi.fn()
      .mockResolvedValueOnce({ sellerCostArs: 2_000, currencyId: 'ARS' })
      .mockResolvedValueOnce({ sellerCostArs: 2_000, currencyId: 'ARS' });
    const result = await quoteSupplierProductShipping({
      accountId: 'account-1', dimensions: { heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 }, pricing,
    }, { quote });

    expect(quote).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ sellerCostArs: 2_000, recommendedPrice: 19_285.72, marginPercentage: 20 });
  });
});
