import { createHash } from 'node:crypto';
import { MarketplaceWebhookStatus, OrderStatus, Prisma } from '@prisma/client';
import { logSystemEvent } from './logger';
import { portalDb } from './portal';
import { createSupplierOrder } from './supplier-order-service';
import { withDistributedLock } from './distributed-lock';

const supportedTopics = new Set(['orders', 'orders_v2', 'payments', 'shipments', 'items']);
const resourcePattern = /^\/(orders|collections|shipments|items)\/[A-Za-z0-9_-]{1,80}$/;

export type MercadoLibreNotification = {
  _id?: string;
  topic: string;
  resource: string;
  user_id: string | number;
  application_id: string | number;
  attempts?: number;
  sent?: string;
  received?: string;
};

export interface MercadoLibreResourceClient {
  get(resource: string): Promise<Record<string, unknown>>;
}

export class MercadoLibreOrderClient implements MercadoLibreResourceClient {
  constructor(
    private readonly accessToken = process.env.MERCADO_LIBRE_ACCESS_TOKEN || '',
    private readonly baseUrl = process.env.MERCADO_LIBRE_API_BASE_URL || 'https://api.mercadolibre.com',
  ) {}

  async get(resource: string) {
    if (!resourcePattern.test(resource)) throw new Error('Recurso de Mercado Libre inválido.');
    if (!this.accessToken.trim()) throw new Error('Mercado Libre no está configurado.');
    const response = await fetch(`${this.baseUrl}${resource}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error(`Mercado Libre rechazó la consulta del recurso (HTTP ${response.status}).`);
    const data: unknown = await response.json();
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Mercado Libre devolvió un recurso inválido.');
    return data as Record<string, unknown>;
  }
}

type EventRecord = { id: string; status: MarketplaceWebhookStatus };

type OrderDependencies = {
  client?: MercadoLibreResourceClient;
  reserveEvent?: (eventKey: string, notification: MercadoLibreNotification) => Promise<EventRecord>;
  completeEvent?: (id: string, status: MarketplaceWebhookStatus, resource: Prisma.InputJsonValue) => Promise<unknown>;
  failEvent?: (id: string, error: string) => Promise<unknown>;
  findListing?: (marketplaceAccountId: string, marketplaceItemId: string) => Promise<{
    id: string;
    supplierProduct: { id: string; supplierId: string; cost: Prisma.Decimal | null };
  } | null>;
  upsertOrder?: (input: InternalOrderInput) => Promise<{ id: string }>;
  submitSupplierOrder?: (orderId: string) => Promise<unknown>;
  logger?: typeof logSystemEvent;
  expectedApplicationId?: string;
  withLock?: typeof withDistributedLock;
};

type InternalOrderInput = {
  marketplaceOrderId: string;
  marketplaceAccountId: string;
  supplierId: string;
  supplierProductId: string;
  listingId: string;
  quantity: number;
  salePrice: number;
  supplierCost: number;
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  profit: number;
  financialsEstimated: boolean;
  customerData: Prisma.InputJsonValue;
  shippingData: Prisma.InputJsonValue;
  status: OrderStatus;
  paymentStatus?: string;
  shippingStatus?: string;
  currency?: string;
  buyerId?: string;
  orderedAt?: Date;
  rawData: Prisma.InputJsonValue;
};

function scalar(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function finite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function configuredMoney(name: string) {
  const parsed = Number(process.env[name] || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function mercadoLibreEventKey(notification: MercadoLibreNotification) {
  if (typeof notification._id === 'string' && /^[A-Za-z0-9_-]{6,100}$/.test(notification._id)) {
    return notification._id;
  }
  return createHash('sha256').update(JSON.stringify({
    topic: notification.topic,
    resource: notification.resource,
    userId: String(notification.user_id),
    applicationId: String(notification.application_id),
    sent: notification.sent || '',
    received: notification.received || '',
  })).digest('hex');
}

export function parseMercadoLibreNotification(value: unknown): MercadoLibreNotification {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Notificación inválida.');
  const input = value as Record<string, unknown>;
  const topic = scalar(input.topic);
  const resource = scalar(input.resource);
  const userId = scalar(input.user_id);
  const applicationId = scalar(input.application_id);
  if (!topic || !supportedTopics.has(topic) || !resource || !resourcePattern.test(resource) || !userId || !applicationId) {
    throw new Error('Notificación inválida.');
  }
  return {
    _id: scalar(input._id),
    topic,
    resource,
    user_id: userId,
    application_id: applicationId,
    attempts: finite(input.attempts),
    sent: scalar(input.sent),
    received: scalar(input.received),
  };
}

type ListingSnapshot = NonNullable<Awaited<ReturnType<NonNullable<OrderDependencies['findListing']>>>>;

function internalStatus(resource: Record<string, unknown>, shipping?: Record<string, unknown>) {
  const orderStatus = scalar(resource.status)?.toLowerCase();
  const shippingStatus = scalar(shipping?.status)?.toLowerCase();
  if (orderStatus === 'cancelled') return OrderStatus.CANCELLED;
  if (shippingStatus === 'delivered') return OrderStatus.DELIVERED;
  if (shippingStatus === 'shipped') return OrderStatus.SHIPPED;
  if (shippingStatus === 'ready_to_ship') return OrderStatus.PROCESSING;
  return OrderStatus.PENDING;
}

function orderInput(resource: Record<string, unknown>, accountId: string, listing: ListingSnapshot): InternalOrderInput {
  const id = scalar(resource.id);
  if (!id) throw new Error('La orden de Mercado Libre no tiene ID.');
  const orderItems = Array.isArray(resource.order_items) ? resource.order_items : [];
  if (orderItems.length !== 1 || !orderItems[0] || typeof orderItems[0] !== 'object') {
    throw new Error('La orden debe contener exactamente un producto vinculado.');
  }
  const quantity = finite((orderItems[0] as Record<string, unknown>).quantity);
  const salePrice = finite(resource.total_amount);
  const supplierCost = listing.supplierProduct.cost == null ? undefined : Number(listing.supplierProduct.cost);
  if (!quantity || !Number.isSafeInteger(quantity) || salePrice == null || supplierCost == null || !Number.isFinite(supplierCost)) {
    throw new Error('La orden no tiene cantidad, precio o costo válido.');
  }
  const payments = Array.isArray(resource.payments) ? resource.payments : [];
  const payment = payments.find((entry) => entry && typeof entry === 'object') as Record<string, unknown> | undefined;
  const shipping = resource.shipping && typeof resource.shipping === 'object'
    ? resource.shipping as Record<string, unknown>
    : undefined;
  const buyer = resource.buyer && typeof resource.buyer === 'object'
    ? resource.buyer as Record<string, unknown>
    : undefined;
  const dateCreated = scalar(resource.date_created);
  const parsedDate = dateCreated ? new Date(dateCreated) : undefined;
  const marketplaceFee = configuredMoney('MERCADO_LIBRE_MARKETPLACE_FEE');
  const shippingCost = configuredMoney('MERCADO_LIBRE_SHIPPING_COST');
  const taxes = configuredMoney('MERCADO_LIBRE_TAXES');
  return {
    marketplaceOrderId: id,
    marketplaceAccountId: accountId,
    supplierId: listing.supplierProduct.supplierId,
    supplierProductId: listing.supplierProduct.id,
    listingId: listing.id,
    quantity,
    salePrice,
    supplierCost,
    marketplaceFee,
    shippingCost,
    taxes,
    profit: Math.round((salePrice - supplierCost * quantity - marketplaceFee - shippingCost - taxes) * 100) / 100,
    financialsEstimated: true,
    customerData: (buyer || {}) as Prisma.InputJsonValue,
    shippingData: (shipping || {}) as Prisma.InputJsonValue,
    status: internalStatus(resource, shipping),
    paymentStatus: scalar(payment?.status),
    shippingStatus: scalar(shipping?.status),
    currency: scalar(resource.currency_id),
    buyerId: scalar(buyer?.id),
    orderedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
    rawData: resource as Prisma.InputJsonValue,
  };
}

function firstItemId(resource: Record<string, unknown>) {
  const items = Array.isArray(resource.order_items) ? resource.order_items : [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = (raw as Record<string, unknown>).item;
    if (item && typeof item === 'object') {
      const id = scalar((item as Record<string, unknown>).id);
      if (id) return id;
    }
  }
}

export async function processMercadoLibreNotification(
  notification: MercadoLibreNotification,
  dependencies: OrderDependencies = {},
) {
  const expectedApplicationId = dependencies.expectedApplicationId ?? process.env.MERCADO_LIBRE_APPLICATION_ID;
  if (expectedApplicationId && String(notification.application_id) !== expectedApplicationId) {
    throw new Error('Notificación inválida.');
  }
  const runWithLock = dependencies.withLock || withDistributedLock;
  return runWithLock(`mercado-libre-webhook:${mercadoLibreEventKey(notification)}`, async () => {
  const reserveEvent = dependencies.reserveEvent || ((key, event) => portalDb.marketplaceWebhookEvent.upsert({
    where: { eventKey: key },
    create: {
      eventKey: key,
      topic: event.topic,
      resource: event.resource,
      userId: String(event.user_id),
      applicationId: String(event.application_id),
      attempts: event.attempts || 1,
      payload: event as Prisma.InputJsonValue,
    },
    update: { attempts: event.attempts || 1 },
    select: { id: true, status: true },
  }));
  const completeEvent = dependencies.completeEvent || ((id, status, resource) => portalDb.marketplaceWebhookEvent.update({
    where: { id }, data: { status, resourceData: resource, processedAt: new Date(), error: null },
  }));
  const failEvent = dependencies.failEvent || ((id, error) => portalDb.marketplaceWebhookEvent.update({
    where: { id }, data: { status: MarketplaceWebhookStatus.ERROR, error: error.slice(0, 500) },
  }));
  const findListing = dependencies.findListing || ((accountId, itemId) => portalDb.marketplaceListing.findUnique({
    where: {
      marketplace_marketplaceAccountId_marketplaceItemId: {
        marketplace: 'MERCADO_LIBRE', marketplaceAccountId: accountId, marketplaceItemId: itemId,
      },
    },
    select: { id: true, supplierProduct: { select: { id: true, supplierId: true, cost: true } } },
  }));
  const upsertOrder = dependencies.upsertOrder || ((input) => portalDb.order.upsert({
    where: { marketplaceOrderId: input.marketplaceOrderId },
    create: { marketplace: 'MERCADO_LIBRE', ...input },
    // Commercial values are immutable snapshots from the first confirmed sale.
    update: {
      status: input.status,
      paymentStatus: input.paymentStatus,
      shippingStatus: input.shippingStatus,
      customerData: input.customerData,
      shippingData: input.shippingData,
      buyerId: input.buyerId,
      rawData: input.rawData,
    },
  }));
  const logger = dependencies.logger || logSystemEvent;
  const submitSupplierOrder = dependencies.submitSupplierOrder || createSupplierOrder;
  const event = await reserveEvent(mercadoLibreEventKey(notification), notification);
  if (event.status === MarketplaceWebhookStatus.PROCESSED || event.status === MarketplaceWebhookStatus.IGNORED) {
    return { status: 'duplicate' as const };
  }

  try {
    const resource = await (dependencies.client || new MercadoLibreOrderClient()).get(notification.resource);
    if (notification.topic === 'orders' || notification.topic === 'orders_v2') {
      const itemId = firstItemId(resource);
      const listing = itemId ? await findListing(String(notification.user_id), itemId) : null;
      if (!listing) throw new Error('La orden no corresponde a una publicación vinculada.');
      const internalOrder = await upsertOrder(orderInput(resource, String(notification.user_id), listing));
      await submitSupplierOrder(internalOrder.id);
      await completeEvent(event.id, MarketplaceWebhookStatus.PROCESSED, resource as Prisma.InputJsonValue);
      await logger('INFO', 'mercado_libre_webhook', 'Mercado Libre order synchronized', {
        topic: notification.topic,
        resource: notification.resource,
        marketplaceAccountId: String(notification.user_id),
      });
      return { status: 'processed' as const };
    }
    await completeEvent(event.id, MarketplaceWebhookStatus.PROCESSED, resource as Prisma.InputJsonValue);
    return { status: 'processed' as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la notificación.';
    await failEvent(event.id, message);
    await logger('ERROR', 'mercado_libre_webhook', 'Mercado Libre webhook processing failed', {
      topic: notification.topic,
      resource: notification.resource,
      error: message,
    });
    throw error;
  }
  }, { ttlMs: 60_000, waitMs: 5_000 });
}
