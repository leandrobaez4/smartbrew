import { z } from 'zod';
import { getMercadoLibreAccessToken } from './mercado-libre-oauth';

const mla = z.string().trim().toUpperCase().regex(/^MLA\d{6,20}$/);
const searchResponse = z.object({ results: z.array(mla).max(200) }).passthrough();
const itemResponse = z.object({
  id: mla,
  seller_id: z.union([z.string(), z.number()]).transform(String),
  price: z.number().finite().nonnegative(),
  status: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(500),
  permalink: z.string().url(),
}).passthrough();

export type MercadoLibreListingCandidate = z.infer<typeof itemResponse>;

export class MercadoLibreListingLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MercadoLibreListingLookupError';
  }
}

export class MercadoLibreListingLookupClient {
  constructor(
    private readonly accessToken?: string,
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  private async token(accountId: string) {
    if (this.accessToken !== undefined) {
      if (!this.accessToken.trim()) throw new MercadoLibreListingLookupError('Mercado Libre no está conectado.');
      return this.accessToken;
    }
    return getMercadoLibreAccessToken({ accountId });
  }

  private async read(path: string, accountId: string) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${await this.token(accountId)}` },
      cache: 'no-store',
    });
    if (!response.ok) throw new MercadoLibreListingLookupError(`Mercado Libre no pudo validar la publicación (HTTP ${response.status}).`);
    return response.json() as Promise<unknown>;
  }

  async getItem(accountId: string, itemId: string) {
    const normalizedAccountId = accountId.trim();
    if (!/^\d{1,30}$/.test(normalizedAccountId)) throw new MercadoLibreListingLookupError('La cuenta de Mercado Libre no es válida.');
    const normalizedItemId = mla.parse(itemId);
    const parsed = itemResponse.safeParse(await this.read(`/items/${encodeURIComponent(normalizedItemId)}`, normalizedAccountId));
    if (!parsed.success || parsed.data.seller_id !== normalizedAccountId) {
      throw new MercadoLibreListingLookupError('La publicación no pertenece a la cuenta conectada.');
    }
    return parsed.data;
  }

  async searchBySellerSku(accountId: string, sellerSku: string) {
    const sku = sellerSku.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/.test(sku)) throw new MercadoLibreListingLookupError('El SKU no es válido.');
    const normalizedAccountId = accountId.trim();
    if (!/^\d{1,30}$/.test(normalizedAccountId)) throw new MercadoLibreListingLookupError('La cuenta de Mercado Libre no es válida.');
    const query = new URLSearchParams({ seller_sku: sku });
    const parsed = searchResponse.safeParse(await this.read(`/users/${encodeURIComponent(normalizedAccountId)}/items/search?${query}`, normalizedAccountId));
    if (!parsed.success) throw new MercadoLibreListingLookupError('Mercado Libre devolvió una respuesta inválida.');
    const candidates = await Promise.all(parsed.data.results.map((itemId) => this.getItem(normalizedAccountId, itemId)));
    return candidates;
  }
}
