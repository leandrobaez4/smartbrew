export type MarketplacePublicationInput = {
  title: string;
  description: string;
  categoryId: string;
  price: number;
  currencyId: string;
  quantity: number;
  images: string[];
  attributes: Array<{ id: string; value_name: string }>;
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
    private readonly accessToken = process.env.MERCADO_LIBRE_ACCESS_TOKEN || '',
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  private async request(path: string, body: unknown) {
    if (!this.accessToken.trim()) throw new MarketplacePublicationError('Mercado Libre no está configurado.');
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async publish(input: MarketplacePublicationInput) {
    const itemResponse = await this.request('/items', {
      title: input.title,
      category_id: input.categoryId,
      price: input.price,
      currency_id: input.currencyId,
      available_quantity: input.quantity,
      buying_mode: 'buy_it_now',
      listing_type_id: 'gold_special',
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
