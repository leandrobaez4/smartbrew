import { PricingService } from './pricing';
import { MercadoLibreShippingClient } from './mercado-libre-shipping';
import { SupplierPackage } from './supplier-package';

export type ShippingPricingRecord = {
  supplierCostWithTaxesArs: unknown;
  marketplaceFeePercentage: unknown;
  marketplaceFixedFeeArs: unknown;
  productSearchCostArs: unknown;
  targetMarginPercentage: unknown;
  finalPriceArs: unknown;
  marketplaceListingTypeId: string;
};

export async function quoteSupplierProductShipping(input: {
  accountId: string;
  dimensions: SupplierPackage;
  pricing: ShippingPricingRecord;
  minimumMarginPercentage?: number;
  minimumProfitAmount?: number;
}, client: Pick<MercadoLibreShippingClient, 'quote'> = new MercadoLibreShippingClient()) {
  const targetMarginPercentage = Number(input.pricing.targetMarginPercentage);
  const minimumMarginPercentage = input.minimumMarginPercentage ?? targetMarginPercentage;
  const pricingService = new PricingService({ minimumMarginPercentage, minimumProfitAmount: input.minimumProfitAmount });
  const calculate = (shippingCost: number) => pricingService.calculate({
    supplierCost: Number(input.pricing.supplierCostWithTaxesArs),
    marketplaceFee: Number(input.pricing.marketplaceFixedFeeArs),
    marketplaceFeePercentage: Number(input.pricing.marketplaceFeePercentage),
    shippingCost,
    taxes: 0,
    extraCosts: Number(input.pricing.productSearchCostArs),
    targetMarginPercentage,
  });
  let itemPriceArs = Number(input.pricing.finalPriceArs);
  let quote = await client.quote({
    accountId: input.accountId,
    dimensions: input.dimensions,
    itemPriceArs,
    listingTypeId: input.pricing.marketplaceListingTypeId,
  });
  let calculation = calculate(quote.sellerCostArs);
  if (calculation.recommendedPrice !== itemPriceArs) {
    itemPriceArs = calculation.recommendedPrice;
    quote = await client.quote({
      accountId: input.accountId,
      dimensions: input.dimensions,
      itemPriceArs,
      listingTypeId: input.pricing.marketplaceListingTypeId,
    });
    calculation = calculate(quote.sellerCostArs);
  }
  return { ...quote, ...calculation };
}
