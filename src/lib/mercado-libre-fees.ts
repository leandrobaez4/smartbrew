import { portalDb } from './portal';
import { calculateSupplierProductPricing } from './supplier-product-pricing';

export type MercadoLibreFeeQuote = {
  percentage: number;
  fixedFeeArs: number;
  saleFeeAmountArs: number;
};

type ListingPriceResponse = {
  listing_type_id?: unknown;
  sale_fee_amount?: unknown;
  sale_fee_details?: {
    fixed_fee?: unknown;
    meli_percentage_fee?: unknown;
    percentage_fee?: unknown;
  };
};

function finiteNonNegative(value: unknown) {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function parseMercadoLibreFeeQuote(payload: unknown, listingTypeId: string): MercadoLibreFeeQuote {
  const rows = (Array.isArray(payload) ? payload.flat(2) : [payload]).filter((row): row is ListingPriceResponse => Boolean(row) && typeof row === 'object');
  const row = rows.find((candidate) => candidate.listing_type_id === listingTypeId) || rows[0];
  const percentage = finiteNonNegative(row?.sale_fee_details?.meli_percentage_fee)
    ?? finiteNonNegative(row?.sale_fee_details?.percentage_fee);
  const fixedFeeArs = finiteNonNegative(row?.sale_fee_details?.fixed_fee) ?? 0;
  const saleFeeAmountArs = finiteNonNegative(row?.sale_fee_amount);
  if (percentage === null || percentage >= 100 || saleFeeAmountArs === null) {
    throw new Error('Mercado Libre devolvió una comisión inválida.');
  }
  return { percentage, fixedFeeArs, saleFeeAmountArs };
}

export class MercadoLibreFeeClient {
  constructor(
    private readonly accessToken = process.env.MERCADO_LIBRE_ACCESS_TOKEN || '',
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  async quote(input: { categoryId: string; priceArs: number; listingTypeId: string }) {
    if (!this.accessToken.trim()) throw new Error('Mercado Libre no está configurado.');
    if (!/^MLA\d+$/.test(input.categoryId) || !Number.isFinite(input.priceArs) || input.priceArs <= 0) {
      throw new Error('Faltan datos válidos para consultar la comisión.');
    }
    const query = new URLSearchParams({
      category_id: input.categoryId,
      price: String(input.priceArs),
      currency_id: 'ARS',
      listing_type_id: input.listingTypeId,
    });
    const response = await fetch(`${this.baseUrl}/sites/MLA/listing_prices?${query}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error(`Mercado Libre rechazó la consulta de comisión (HTTP ${response.status}).`);
    return parseMercadoLibreFeeQuote(await response.json(), input.listingTypeId);
  }
}

export async function syncMarketplaceFees(client: Pick<MercadoLibreFeeClient, 'quote'> = new MercadoLibreFeeClient()) {
  const records = await portalDb.supplierProductPricing.findMany({
    where: { marketplaceCategoryId: { not: null } },
    orderBy: { marketplaceFeeSyncedAt: { sort: 'asc', nulls: 'first' } },
    take: 100,
  });
  const results: Array<{ supplierProductId: string; status: 'updated' | 'failed'; error?: string }> = [];
  for (const record of records) {
    try {
      const quote = await client.quote({
        categoryId: record.marketplaceCategoryId!,
        priceArs: Number(record.finalPriceArs),
        listingTypeId: record.marketplaceListingTypeId,
      });
      const pricing = calculateSupplierProductPricing({
        supplierPriceUsd: Number(record.supplierPriceUsd),
        exchangeRateArsPerUsd: Number(record.exchangeRateArsPerUsd),
        vatPercentage: Number(record.vatPercentage),
        productSearchCostArs: Number(record.productSearchCostArs),
        shippingCostArs: Number(record.shippingCostArs),
        marketplaceFeePercentage: quote.percentage,
        // The official fixed fee depends on logistics and billable weight. Preserve the configured value until those are known.
        marketplaceFixedFeeArs: Number(record.marketplaceFixedFeeArs),
        marketplaceCategoryId: record.marketplaceCategoryId || '',
        marketplaceListingTypeId: record.marketplaceListingTypeId as 'gold_special' | 'gold_pro',
        targetMarginPercentage: Number(record.targetMarginPercentage),
      });
      await portalDb.supplierProductPricing.update({
        where: { id: record.id },
        data: { ...pricing, marketplaceFeeSyncedAt: new Date() },
      });
      results.push({ supplierProductId: record.supplierProductId, status: 'updated' });
    } catch (error) {
      results.push({ supplierProductId: record.supplierProductId, status: 'failed', error: error instanceof Error ? error.message : 'Error desconocido.' });
    }
  }
  return {
    processed: results.length,
    updated: results.filter((result) => result.status === 'updated').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}
