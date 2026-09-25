import { z } from 'zod';

const finiteMoney = z.coerce.number().finite().nonnegative().max(1_000_000_000);
const percentage = z.coerce.number().finite().nonnegative().lt(100);

export const SupplierProductPricingSchema = z.object({
  supplierPriceUsd: finiteMoney.positive(),
  exchangeRateArsPerUsd: finiteMoney.positive(),
  vatPercentage: percentage,
  productSearchCostArs: finiteMoney,
  shippingCostArs: finiteMoney,
  marketplaceFeePercentage: percentage,
  marketplaceFixedFeeArs: finiteMoney,
  marketplaceCategoryId: z.string().trim().regex(/^MLA\d+$/, 'Ingresá una categoría de Mercado Libre válida.').or(z.literal('')),
  marketplaceListingTypeId: z.enum(['gold_special', 'gold_pro']),
  targetMarginPercentage: z.coerce.number().finite().nonnegative().max(80),
});

export type SupplierProductPricingInput = z.infer<typeof SupplierProductPricingSchema>;

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundUp = (value: number) => Math.ceil((value - Number.EPSILON) * 100) / 100;

export function calculateSupplierProductPricing(input: SupplierProductPricingInput) {
  const parsed = SupplierProductPricingSchema.parse(input);
  const supplierPriceArs = parsed.supplierPriceUsd * parsed.exchangeRateArsPerUsd;
  const vatAmountUsd = parsed.supplierPriceUsd * parsed.vatPercentage / 100;
  const vatAmountArs = supplierPriceArs * parsed.vatPercentage / 100;
  const supplierCostWithVatUsd = parsed.supplierPriceUsd + vatAmountUsd;
  const supplierCostWithVatArs = supplierPriceArs + vatAmountArs;
  const nonPercentageCosts = supplierCostWithVatArs
    + parsed.productSearchCostArs
    + parsed.shippingCostArs
    + parsed.marketplaceFixedFeeArs;
  const targetProfitArs = nonPercentageCosts * parsed.targetMarginPercentage / 100;
  const finalPriceArs = roundUp((nonPercentageCosts + targetProfitArs) / (1 - parsed.marketplaceFeePercentage / 100));
  const marketplaceFeeAmountArs = finalPriceArs * parsed.marketplaceFeePercentage / 100 + parsed.marketplaceFixedFeeArs;
  const totalCostArs = supplierCostWithVatArs
    + parsed.productSearchCostArs
    + parsed.shippingCostArs
    + marketplaceFeeAmountArs;

  return {
    supplierPriceUsd: round(parsed.supplierPriceUsd),
    exchangeRateArsPerUsd: round(parsed.exchangeRateArsPerUsd),
    supplierPriceArs: round(supplierPriceArs),
    vatPercentage: round(parsed.vatPercentage),
    vatAmountUsd: round(vatAmountUsd),
    vatAmountArs: round(vatAmountArs),
    supplierCostWithVatUsd: round(supplierCostWithVatUsd),
    supplierCostWithVatArs: round(supplierCostWithVatArs),
    productSearchCostArs: round(parsed.productSearchCostArs),
    shippingCostArs: round(parsed.shippingCostArs),
    marketplaceFeePercentage: round(parsed.marketplaceFeePercentage),
    marketplaceFixedFeeArs: round(parsed.marketplaceFixedFeeArs),
    marketplaceFeeAmountArs: round(marketplaceFeeAmountArs),
    marketplaceCategoryId: parsed.marketplaceCategoryId || null,
    marketplaceListingTypeId: parsed.marketplaceListingTypeId,
    targetMarginPercentage: round(parsed.targetMarginPercentage),
    targetProfitArs: round(targetProfitArs),
    totalCostArs: round(totalCostArs),
    finalPriceArs,
  };
}
