import { SupplierIntegrationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnectorFactory } from './connectors';
import { ElitApiConnector, normalizeElitApiProduct, registerElitApiConnector } from './elit-api';

const apiProduct = {
  id: 6358,
  codigo_alfa: 'AUR-6358',
  codigo_producto: '981-000612',
  nombre: 'Auricular Logitech H111',
  marca: 'Logitech',
  categoria: 'Auriculares',
  sub_categoria: 'Con cable',
  precio: 10,
  iva: 21,
  impuesto_interno: 1,
  moneda: 2,
  cotizacion: 1_535,
  pvp_usd: 15,
  pvp_ars: 23_025,
  markup: 30,
  stock_total: 8,
  ean: '097855114976',
  imagenes: ['https://images.elit.com.ar/6358.webp'],
  atributos: [{ nombre: 'Color', valor: 'Negro' }],
  link: 'https://www.elit.com.ar/producto/6358-auricular',
};

const config = {
  supplierId: 'elit-supplier',
  slug: 'elit',
  integrationType: SupplierIntegrationType.API,
  connectorKey: 'elit-v1',
  apiUrl: 'https://clientes.elit.com.ar/v1/api',
  credentials: { username: '31916', apiKey: 'secret-token' },
};

function response(products = [apiProduct]) {
  return new Response(JSON.stringify({
    codigo: 200,
    paginador: { total: products.length, limit: 1, offset: 0 },
    resultado: products,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('Elit API adapter', () => {
  it('normalizes taxes, currency, stock and commercial references', () => {
    expect(normalizeElitApiProduct(apiProduct)).toMatchObject({
      externalId: '6358',
      sku: '981-000612',
      cost: 20_108.5,
      currency: 'ARS',
      stock: 8,
      attributes: { Color: 'Negro', subCategory: 'Con cable' },
      pricing: {
        supplierCurrency: 'USD',
        supplierPriceUsd: 10,
        exchangeRateArsPerUsd: 1_535,
        vatPercentage: 21,
        internalTaxAmountArs: 1_535,
        supplierCostWithTaxesArs: 20_108.5,
        supplierPvpUsd: 15,
        supplierPvpArs: 23_025,
        supplierMarkupPercentage: 30,
      },
    });
  });

  it('queries only the requested product and keeps credentials out of the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const connector = new ElitApiConnector(config, fetcher);

    await expect(connector.getProduct('6358')).resolves.toMatchObject({ externalId: '6358', stock: 8 });
    const [url, request] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain('/productos?limit=1&offset=0&id=6358');
    expect(url.toString()).not.toContain('secret-token');
    expect(JSON.parse(String(request.body))).toEqual({ user_id: 31916, token: 'secret-token' });
  });

  it('registers targeted monitoring capabilities without enabling full catalog downloads', async () => {
    const logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerElitApiConnector(new SupplierConnectorFactory(logger), vi.fn().mockResolvedValue(response()));
    const connector = factory.make(config);

    expect(connector.capabilities).toEqual(['product', 'price', 'stock']);
    await expect(connector.getPrice('6358')).resolves.toEqual({ amount: 20_108.5, currency: 'ARS' });
    await expect(connector.getProducts()).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
  });

  it('rejects unsafe hosts, missing credentials and ambiguous USD pricing', () => {
    expect(() => new ElitApiConnector({ ...config, apiUrl: 'https://example.com/v1/api' })).toThrow('official HTTPS host');
    expect(() => new ElitApiConnector({ ...config, credentials: {} })).toThrow('credentials');
    expect(() => normalizeElitApiProduct({ ...apiProduct, cotizacion: 0 })).toThrow('exchange rate');
  });
});
