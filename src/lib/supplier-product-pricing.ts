import { z } from 'zod';
import { PricingService } from './pricing';

const finiteMoney = z.coerce.number().finite().nonnegative().max(1_000_000_000);
const percentage = z.coerce.number().finite().nonnegative().lt(100);

export const SupplierProductPricingSchema = z.object({
  supplierPriceUsd: finiteMoney.default(0),
  supplierPriceArs: finiteMoney.default(0),
  supplierCurrency: z.enum(['USD', 'ARS']).default('USD'),
  exchangeRateArsPerUsd: finiteMoney.default(0),
  vatTreatment: z.enum(['INCLUDED', 'EXCLUDED', 'UNKNOWN']).default('EXCLUDED'),
  vatPercentage: percentage,
  internalTaxAmountUsd: finiteMoney.default(0),
  internalTaxAmountArs: finiteMoney.default(0),
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
}).superRefine((value, context) => {
  if (value.supplierCurrency === 'USD' && value.supplierPriceUsd <= 0) {
    context.addIssue({ code: 'custom', message: 'El costo en USD debe ser mayor que cero.', path: ['supplierPriceUsd'] });
  }
  if (value.supplierCurrency === 'USD' && value.exchangeRateArsPerUsd <= 0) {
    context.addIssue({ code: 'custom', message: 'La cotización debe ser mayor que cero.', path: ['exchangeRateArsPerUsd'] });
  }
  if (value.supplierCurrency === 'ARS' && value.supplierPriceArs <= 0) {
    context.addIssue({ code: 'custom', message: 'El costo en ARS debe ser mayor que cero.', path: ['supplierPriceArs'] });
  }
  if (value.targetMarginPercentage + value.marketplaceFeePercentage >= 100) {
    context.addIssue({ code: 'custom', message: 'El margen y la comisión deben sumar menos de 100%.', path: ['targetMarginPercentage'] });
  }
});

export type SupplierProductPricingInput = z.infer<typeof SupplierProductPricingSchema>;

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSupplierProductPricing(input: SupplierProductPricingInput) {
  const parsed = SupplierProductPricingSchema.parse(input);
  const supplierPriceUsd = parsed.supplierCurrency === 'USD' ? parsed.supplierPriceUsd : 0;
  const supplierPriceArs = parsed.supplierCurrency === 'USD'
    ? supplierPriceUsd * parsed.exchangeRateArsPerUsd
    : parsed.supplierPriceArs;
  const vatRate = parsed.vatPercentage / 100;
  const vatAmountArs = parsed.vatTreatment === 'UNKNOWN'
    ? 0
    : parsed.vatTreatment === 'INCLUDED'
      ? supplierPriceArs - supplierPriceArs / (1 + vatRate)
      : supplierPriceArs * vatRate;
  const vatAmountUsd = parsed.supplierCurrency === 'USD'
    ? (parsed.vatTreatment === 'UNKNOWN'
      ? 0
      : parsed.vatTreatment === 'INCLUDED'
        ? supplierPriceUsd - supplierPriceUsd / (1 + vatRate)
        : supplierPriceUsd * vatRate)
    : 0;
  const supplierCostWithVatUsd = parsed.vatTreatment === 'EXCLUDED' ? supplierPriceUsd + vatAmountUsd : supplierPriceUsd;
  const supplierCostWithVatArs = parsed.vatTreatment === 'EXCLUDED' ? supplierPriceArs + vatAmountArs : supplierPriceArs;
  const internalTaxAmountArs = parsed.supplierCurrency === 'USD'
    ? parsed.internalTaxAmountUsd * parsed.exchangeRateArsPerUsd
    : parsed.internalTaxAmountArs;
  const supplierCostWithTaxesUsd = supplierCostWithVatUsd + parsed.internalTaxAmountUsd;
  const supplierCostWithTaxesArs = supplierCostWithVatArs + internalTaxAmountArs;
  const result = new PricingService({ minimumMarginPercentage: parsed.targetMarginPercentage }).calculate({
    supplierCost: supplierCostWithTaxesArs,
    marketplaceFee: parsed.marketplaceFixedFeeArs,
    marketplaceFeePercentage: parsed.marketplaceFeePercentage,
    shippingCost: parsed.shippingCostArs,
    taxes: 0,
    extraCosts: parsed.productSearchCostArs,
    targetMarginPercentage: parsed.targetMarginPercentage,
  });
  const marketplaceFeeAmountArs = result.marketplaceFeeAmount;
  const targetProfitArs = result.netProfit;
  const finalPriceArs = result.recommendedPrice;
  const totalCostArs = finalPriceArs - targetProfitArs;

  return {
    supplierPriceUsd: round(supplierPriceUsd),
    supplierCurrency: parsed.supplierCurrency,
    exchangeRateArsPerUsd: round(parsed.exchangeRateArsPerUsd),
    supplierPriceArs: round(supplierPriceArs),
    vatPercentage: parsed.vatTreatment === 'UNKNOWN' ? 0 : round(parsed.vatPercentage),
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
    netMarginPercentage: result.marginPercentage,
    roiPercentage: result.roi,
    totalCostArs: round(totalCostArs),
    finalPriceArs,
  };
}

export function inferVatTreatment(input: {
  supplierCurrency: string;
  supplierPriceArs: number;
  supplierCostWithVatArs: number;
  vatPercentage: number;
}) {
  if (input.vatPercentage <= 0) return 'UNKNOWN' as const;
  if (input.supplierCurrency === 'ARS' && Math.abs(input.supplierPriceArs - input.supplierCostWithVatArs) < 0.01) {
    return 'INCLUDED' as const;
  }
  return 'EXCLUDED' as const;
}
