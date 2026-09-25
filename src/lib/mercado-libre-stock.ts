export interface MarketplaceStockClient {
  updateAvailableQuantity(marketplaceItemId: string, quantity: number): Promise<void>;
}

export class MarketplaceStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketplaceStockError';
  }
}

function validateQuantity(quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MarketplaceStockError('La cantidad debe ser un entero no negativo.');
  }
}

export class MercadoLibreStockClient implements MarketplaceStockClient {
  constructor(
    private readonly accessToken = process.env.MERCADO_LIBRE_ACCESS_TOKEN || '',
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  async updateAvailableQuantity(marketplaceItemId: string, quantity: number) {
    const itemId = marketplaceItemId.trim();
    if (!itemId) throw new MarketplaceStockError('La publicación no tiene ID de Mercado Libre.');
    validateQuantity(quantity);
    if (!this.accessToken.trim()) throw new MarketplaceStockError('Mercado Libre no está configurado.');

    const response = await fetch(`${this.baseUrl}/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ available_quantity: quantity }),
    });
    if (!response.ok) {
      throw new MarketplaceStockError(`Mercado Libre rechazó la actualización de stock (HTTP ${response.status}).`);
    }
  }
}
