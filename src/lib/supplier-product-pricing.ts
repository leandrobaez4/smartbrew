import { z } from 'zod';

const finiteMoney = z.coerce.number().finite().nonnegative().max(1_000_000_000);
const percentage = z.coerce.number().finite().nonnegative().lt(100);

export const SupplierProductPricingSchema = z.object({
  supplierPriceUsd: finiteMoney.positive(),
  supplierCurrency: z.literal('USD').default('USD'),
  exchangeRateArsPerUsd: finiteMoney.positive(),
  vatPercentage: percentage,
  internalTaxAmountUsd: finiteMoney.default(0),
  supplierPvpUsd: finiteMoney.default(0),
  supplierPvpArs: finiteMoney.default(0),
  supplierMarkupPercentage: percentage.default(0),
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
  const internalTaxAmountArs = parsed.internalTaxAmountUsd * parsed.exchangeRateArsPerUsd;
  const supplierCostWithTaxesUsd = supplierCostWithVatUsd + parsed.internalTaxAmountUsd;
  const supplierCostWithTaxesArs = supplierCostWithVatArs + internalTaxAmountArs;
  const nonPercentageCosts = supplierCostWithTaxesArs
    + parsed.productSearchCostArs
    + parsed.shippingCostArs
    + parsed.marketplaceFixedFeeArs;
  const targetProfitArs = nonPercentageCosts * parsed.targetMarginPercentage / 100;
  const finalPriceArs = roundUp((nonPercentageCosts + targetProfitArs) / (1 - parsed.marketplaceFeePercentage / 100));
  const marketplaceFeeAmountArs = finalPriceArs * parsed.marketplaceFeePercentage / 100 + parsed.marketplaceFixedFeeArs;
  const totalCostArs = supplierCostWithTaxesArs
    + parsed.productSearchCostArs
    + parsed.shippingCostArs
    + marketplaceFeeAmountArs;

  return {
    supplierPriceUsd: round(parsed.supplierPriceUsd),
    supplierCurrency: parsed.supplierCurrency,
    exchangeRateArsPerUsd: round(parsed.exchangeRateArsPerUsd),
    supplierPriceArs: round(supplierPriceArs),
    vatPercentage: round(parsed.vatPercentage),
    vatAmountUsd: round(vatAmountUsd),
    vatAmountArs: round(vatAmountArs),
    supplierCostWithVatUsd: round(supplierCostWithVatUsd),
    supplierCostWithVatArs: round(supplierCostWithVatArs),
    internalTaxAmountUsd: round(parsed.internalTaxAmountUsd),
    internalTaxAmountArs: round(internalTaxAmountArs),
    supplierCostWithTaxesUsd: round(supplierCostWithTaxesUsd),
    supplierCostWithTaxesArs: round(supplierCostWithTaxesArs),
    supplierPvpUsd: parsed.supplierPvpUsd > 0 ? round(parsed.supplierPvpUsd) : null,
    supplierPvpArs: parsed.supplierPvpArs > 0 ? round(parsed.supplierPvpArs) : null,
    supplierMarkupPercentage: parsed.supplierMarkupPercentage > 0 ? round(parsed.supplierMarkupPercentage) : null,
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
