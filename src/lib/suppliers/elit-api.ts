import { z } from 'zod';
import {
  SupplierConnector,
  SupplierConnectorConfig,
  SupplierConnectorFactory,
  SupplierProduct,
} from './connectors';

const ElitAttributeSchema = z.object({
  nombre: z.string().trim().min(1),
  valor: z.union([z.string(), z.number(), z.boolean()]),
});

export const ElitApiProductSchema = z.object({
  id: z.number().int().positive(),
  codigo_alfa: z.string().trim().nullable().optional(),
  codigo_producto: z.string().trim().nullable().optional(),
  nombre: z.string().trim().min(1),
  marca: z.string().trim().nullable().optional(),
  categoria: z.string().trim().nullable().optional(),
  sub_categoria: z.string().trim().nullable().optional(),
  precio: z.number().finite().nonnegative(),
  iva: z.number().finite().nonnegative().max(100).default(0),
  impuesto_interno: z.number().finite().nonnegative().default(0),
  moneda: z.union([z.literal(1), z.literal(2)]),
  cotizacion: z.number().finite().nonnegative().default(0),
  pvp_usd: z.number().finite().nonnegative().nullable().optional(),
  pvp_ars: z.number().finite().nonnegative().nullable().optional(),
  markup: z.number().finite().nonnegative().nullable().optional(),
  nivel_stock: z.string().trim().nullable().optional(),
  stock_total: z.number().int().nonnegative().nullable().optional(),
  stock_deposito_cliente: z.number().int().nonnegative().nullable().optional(),
  stock_deposito_cd: z.number().int().nonnegative().nullable().optional(),
  ean: z.string().trim().nullable().optional(),
  peso: z.number().finite().nonnegative().nullable().optional(),
  garantia: z.string().trim().nullable().optional(),
  imagenes: z.array(z.string().trim().min(1)).default([]),
  miniaturas: z.array(z.string().trim().min(1)).default([]),
  atributos: z.array(ElitAttributeSchema).default([]),
  link: z.string().url().nullable().optional(),
  gamer: z.boolean().nullable().optional(),
  creado: z.string().nullable().optional(),
  actualizado: z.string().nullable().optional(),
}).passthrough();

const ElitApiResponseSchema = z.object({
  codigo: z.number().int(),
  paginador: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  }).optional(),
  resultado: z.array(ElitApiProductSchema),
});

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function unavailable(): never {
  throw new Error('Operation unavailable in the Elit product monitoring adapter.');
}

function apiBaseUrl(value?: string | null) {
  const url = new URL(value || 'https://clientes.elit.com.ar/v1/api');
  if (url.protocol !== 'https:' || url.hostname !== 'clientes.elit.com.ar') {
    throw new Error('Elit API URL must use the official HTTPS host.');
  }
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '/v1/api') throw new Error('Elit API URL must point to /v1/api.');
  return `${url.origin}${pathname}`;
}

function credentials(config: SupplierConnectorConfig) {
  const userId = Number(config.credentials?.username);
  const token = config.credentials?.apiKey?.trim();
  if (!Number.isSafeInteger(userId) || userId <= 0 || !token) {
    throw new Error('Elit API credentials are not configured.');
  }
  return { userId, token };
}

export function normalizeElitApiProduct(input: unknown): SupplierProduct {
  const product = ElitApiProductSchema.parse(input);
  if (product.moneda === 2 && product.cotizacion <= 0) {
    throw new Error('Elit USD products require a valid exchange rate.');
  }
  const exchangeRate = product.cotizacion;
  const supplierPriceArs = product.moneda === 2 ? product.precio * exchangeRate : product.precio;
  const supplierPriceUsd = product.moneda === 2
    ? product.precio
    : exchangeRate > 0 ? product.precio / exchangeRate : null;
  const vatAmountArs = supplierPriceArs * product.iva / 100;
  const internalTaxAmountArs = product.moneda === 2
    ? product.impuesto_interno * exchangeRate
    : product.impuesto_interno;
  const supplierCostWithTaxesArs = round(supplierPriceArs + vatAmountArs + internalTaxAmountArs);
  const attributes = Object.fromEntries(product.atributos.map((attribute) => [attribute.nombre, attribute.valor]));

  return {
    externalId: String(product.id),
    sku: product.codigo_producto || product.codigo_alfa || null,
    ean: product.ean || null,
    title: product.nombre,
    brand: product.marca || null,
    category: product.categoria || product.sub_categoria || null,
    cost: supplierCostWithTaxesArs,
    currency: 'ARS',
    stock: product.stock_total ?? null,
    images: product.imagenes.length ? product.imagenes : product.miniaturas,
    attributes: {
      ...attributes,
      ...(product.sub_categoria ? { subCategory: product.sub_categoria } : {}),
      ...(product.peso != null ? { weightKg: product.peso } : {}),
      ...(product.garantia ? { warranty: product.garantia } : {}),
      ...(product.link ? { sourceUrl: product.link } : {}),
    },
    pricing: {
      supplierCurrency: product.moneda === 2 ? 'USD' : 'ARS',
      supplierPriceUsd: supplierPriceUsd == null ? null : round(supplierPriceUsd),
      exchangeRateArsPerUsd: exchangeRate > 0 ? round(exchangeRate) : null,
      vatPercentage: round(product.iva),
      internalTaxAmountArs: round(internalTaxAmountArs),
      supplierCostWithTaxesArs,
      supplierPvpUsd: product.pvp_usd == null ? null : round(product.pvp_usd),
      supplierPvpArs: product.pvp_ars == null ? null : round(product.pvp_ars),
      supplierMarkupPercentage: product.markup == null ? null : round(product.markup),
    },
    rawData: product,
  };
}

export class ElitApiConnector implements SupplierConnector {
  private readonly baseUrl: string;
  private readonly userId: number;
  private readonly token: string;

  constructor(
    config: SupplierConnectorConfig,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 10_000,
  ) {
    this.baseUrl = apiBaseUrl(config.apiUrl);
    const secret = credentials(config);
    this.userId = secret.userId;
    this.token = secret.token;
  }

  private async requestProduct(externalId: string) {
    if (!/^\d{1,12}$/.test(externalId)) throw new Error('Elit product id must be numeric.');
    const url = new URL(`${this.baseUrl}/productos`);
    url.searchParams.set('limit', '1');
    url.searchParams.set('offset', '0');
    url.searchParams.set('id', externalId);
    const response = await this.fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.userId, token: this.token }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Elit API request failed with status ${response.status}.`);
    const payload = ElitApiResponseSchema.parse(await response.json());
    if (payload.codigo !== 200) throw new Error(`Elit API returned code ${payload.codigo}.`);
    return payload.resultado[0] ? normalizeElitApiProduct(payload.resultado[0]) : null;
  }

  async getProduct(externalId: string) { return this.requestProduct(externalId); }

  async getStock(externalId: string) {
    return (await this.requestProduct(externalId))?.stock ?? null;
  }

  async getPrice(externalId: string) {
    const product = await this.requestProduct(externalId);
    return product?.cost == null ? null : { amount: product.cost, currency: 'ARS' };
  }

  async getProducts() { return unavailable(); }
  async createOrder() { return unavailable(); }
  async getOrderStatus() { return unavailable(); }
}

export function registerElitApiConnector(factory: SupplierConnectorFactory, fetcher?: Fetcher) {
  return factory.register({
    key: 'elit-v1',
    capabilities: ['product', 'price', 'stock'],
    builder: (config) => new ElitApiConnector(config, fetcher),
  });
}
