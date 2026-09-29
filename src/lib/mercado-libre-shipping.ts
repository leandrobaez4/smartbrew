import { getMercadoLibreAccessToken } from './mercado-libre-oauth';
import { SupplierPackage, SupplierPackageSchema } from './supplier-package';

type Coverage = { list_cost?: unknown; currency_id?: unknown };

export type MercadoLibreShippingQuote = {
  sellerCostArs: number;
  currencyId: string;
};

export function parseMercadoLibreShippingQuote(payload: unknown): MercadoLibreShippingQuote {
  const coverage = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as { coverage?: { all_country?: Coverage } }).coverage?.all_country
    : undefined;
  const sellerCostArs = typeof coverage?.list_cost === 'number' ? coverage.list_cost : Number.NaN;
  if (!Number.isFinite(sellerCostArs) || sellerCostArs < 0) throw new Error('Mercado Libre devolvió un costo de envío inválido.');
  return { sellerCostArs, currencyId: typeof coverage?.currency_id === 'string' ? coverage.currency_id : 'ARS' };
}

export class MercadoLibreShippingClient {
  constructor(
    private readonly accessToken?: string,
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  async quote(input: {
    accountId: string;
    dimensions: SupplierPackage;
    itemPriceArs: number;
    listingTypeId: string;
  }) {
    const dimensions = SupplierPackageSchema.parse(input.dimensions);
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.accountId) || !Number.isFinite(input.itemPriceArs) || input.itemPriceArs <= 0) {
      throw new Error('Faltan datos válidos para cotizar el envío.');
    }
    const accessToken = this.accessToken ?? await getMercadoLibreAccessToken({ accountId: input.accountId });
    if (!accessToken.trim()) throw new Error('Mercado Libre no está configurado.');
    const query = new URLSearchParams({
      dimensions: `${dimensions.heightCm}x${dimensions.widthCm}x${dimensions.lengthCm},${dimensions.weightGrams}`,
      item_price: String(input.itemPriceArs),
      listing_type_id: input.listingTypeId,
      mode: 'me2',
      logistic_type: 'drop_off',
      condition: 'new',
      free_shipping: 'false',
    });
    const response = await fetch(`${this.baseUrl}/users/${encodeURIComponent(input.accountId)}/shipping_options/free?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`Mercado Libre rechazó la cotización de envío (HTTP ${response.status}).`);
    return parseMercadoLibreShippingQuote(await response.json());
  }
}
