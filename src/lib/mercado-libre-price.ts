import { getMercadoLibreAccessToken } from './mercado-libre-oauth';

export interface MarketplacePriceClient {
  updatePrice(marketplaceItemId: string, price: number): Promise<void>;
  pause(marketplaceItemId: string): Promise<void>;
}

export class MarketplacePriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketplacePriceError';
  }
}

export class MercadoLibrePriceClient implements MarketplacePriceClient {
  constructor(
    private readonly accessToken?: string,
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  private async update(marketplaceItemId: string, body: unknown) {
    const itemId = marketplaceItemId.trim();
    if (!itemId) throw new MarketplacePriceError('La publicación no tiene ID de Mercado Libre.');
    if (this.accessToken !== undefined && !this.accessToken.trim()) throw new MarketplacePriceError('Mercado Libre no está configurado.');
    const accessToken = this.accessToken ?? await getMercadoLibreAccessToken();
    const response = await fetch(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new MarketplacePriceError(`Mercado Libre rechazó la actualización de precio (HTTP ${response.status}).`);
    }
  }

  async updatePrice(marketplaceItemId: string, price: number) {
    if (!Number.isFinite(price) || price <= 0) {
      throw new MarketplacePriceError('El precio debe ser un número positivo.');
    }
    await this.update(marketplaceItemId, { price });
  }

  async pause(marketplaceItemId: string) {
    await this.update(marketplaceItemId, { status: 'paused' });
  }
}
