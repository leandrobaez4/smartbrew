import { getMercadoLibreAccessToken } from './mercado-libre-oauth';

export type MarketplacePublicationInput = {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  currencyId: string;
  quantity: number;
  images: string[];
  attributes: Array<{ id: string; value_name: string }>;
  listingTypeId: 'gold_special' | 'gold_pro';
};

export interface MarketplacePublisher {
  publish(input: MarketplacePublicationInput): Promise<{ marketplaceItemId: string }>;
}

export class MarketplacePublicationError extends Error {
  constructor(message: string, readonly marketplaceItemId?: string) {
    super(message);
    this.name = 'MarketplacePublicationError';
  }
}

function safeProviderError(status: number) {
  return `Mercado Libre rechazó la publicación (HTTP ${status}).`;
}

export class MercadoLibrePublisher implements MarketplacePublisher {
  constructor(
    private readonly accessToken?: string,
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
    private readonly accountId?: string,
  ) {}

  private async request(path: string, body: unknown) {
    if (this.accessToken !== undefined && !this.accessToken.trim()) throw new MarketplacePublicationError('Mercado Libre no está configurado.');
    const accessToken = this.accessToken ?? await getMercadoLibreAccessToken({ accountId: this.accountId });
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  private async validateMercadoEnvios() {
    if (!this.accountId) return;
    if (this.accessToken !== undefined && !this.accessToken.trim()) throw new MarketplacePublicationError('Mercado Libre no está configurado.');
    const accessToken = this.accessToken ?? await getMercadoLibreAccessToken({ accountId: this.accountId });
    const response = await fetch(`${this.baseUrl}/users/${encodeURIComponent(this.accountId)}/shipping_preferences`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new MarketplacePublicationError(`No se pudo validar Mercado Envíos (HTTP ${response.status}).`);
    const preferences = await response.json() as { modes?: unknown };
    if (!Array.isArray(preferences.modes) || !preferences.modes.includes('me2')) {
      throw new MarketplacePublicationError('La cuenta de Mercado Libre no tiene Mercado Envíos habilitado.');
    }
  }

  async publish(input: MarketplacePublicationInput) {
    await this.validateMercadoEnvios();
    const itemResponse = await this.request('/items', {
      title: input.title,
      category_id: input.categoryId,
      price: input.price,
      currency_id: input.currencyId,
      available_quantity: input.quantity,
      buying_mode: 'buy_it_now',
      condition: 'new',
      listing_type_id: input.listingTypeId,
      shipping: {
        mode: 'me2',
        local_pick_up: false,
        free_shipping: false,
        free_methods: [],
      },
      attributes: input.attributes,
      pictures: input.images.map((source) => ({ source })),
    });
    if (!itemResponse.ok) throw new MarketplacePublicationError(safeProviderError(itemResponse.status));
    const item = await itemResponse.json() as { id?: unknown };
    if (typeof item.id !== 'string' || !item.id.trim()) {
      throw new MarketplacePublicationError('Mercado Libre devolvió una publicación sin ID.');
    }

    const descriptionResponse = await this.request(`/items/${encodeURIComponent(item.id)}/description`, {
      plain_text: input.description,
    });
    if (!descriptionResponse.ok) {
      throw new MarketplacePublicationError(safeProviderError(descriptionResponse.status), item.id);
    }
    return { marketplaceItemId: item.id };
  }
}
