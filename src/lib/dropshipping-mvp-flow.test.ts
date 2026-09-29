import {
  MarketplaceWebhookStatus,
  OrderStatus,
  Prisma,
  SupplierIntegrationType,
  SupplierProductEditorialStatus,
  SupplierStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { processMercadoLibreNotification } from './mercado-libre-orders';
import { publishSupplierProduct } from './supplier-marketplace-publication';
import { createSupplierOrder } from './supplier-order-service';
import { SupplierConnectorFactory } from './suppliers/connectors';
import { registerMockSupplierConnector } from './suppliers/mock';
import { monitorPublishedSupplierProducts } from './suppliers/monitor';

const supplier = {
  id: 'supplier-mvp',
  name: 'MVP Supplier',
  slug: 'mvp-supplier',
  type: 'mock-v1',
  website: null,
  apiUrl: null,
  apiKeyEncrypted: null,
  apiSecretEncrypted: null,
  usernameEncrypted: null,
  passwordEncrypted: null,
  integrationType: SupplierIntegrationType.API,
  status: SupplierStatus.ACTIVE,
  lastSyncAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

function storedProduct(cost = 25_000, stock = 15) {
  return {
    id: 'supplier-product-mvp',
    supplierId: supplier.id,
    externalId: 'TEST-001',
    sku: 'TEST-001',
    ean: null,
    title: 'Auriculares Bluetooth',
    description: 'Auriculares Bluetooth listos para publicar.',
    brand: 'SmartBrew Test',
    category: 'MLA3697',
    cost: new Prisma.Decimal(cost),
    currency: 'ARS',
    stock,
    images: ['https://example.com/auriculares.webp'],
    attributes: {},
    rawData: { source: 'mock' },
    editorialTitle: 'Auriculares Bluetooth SmartBrew',
    editorialDescription: 'Auriculares Bluetooth listos para publicar.',
    editorialBulletPoints: [],
    editorialHighlights: [],
    editorialSeoKeywords: [],
    editorialStatus: SupplierProductEditorialStatus.APPROVED,
    editorialError: null,
    editorialGeneratedAt: new Date(0),
    editorialReviewedAt: new Date(0),
    active: true,
    lastSyncAt: new Date(0),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe('dropshipping MVP critical flow', () => {
  it('runs provider monitoring, profitability, dry-run publication, sale ingestion and manual purchase without external effects', async () => {
    const logger = vi.fn().mockResolvedValue(undefined);
    const product = storedProduct();
    const providerFactory = registerMockSupplierConnector(
      new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }),
      { products: [{
        externalId: product.externalId,
        sku: product.sku,
        title: product.title,
        description: product.description,
        brand: product.brand,
        category: product.category,
        cost: Number(product.cost),
        currency: product.currency,
        stock: product.stock,
        images: product.images,
        rawData: product.rawData,
      }] },
    );
    let monitoredProduct: { cost?: number | null; stock?: number | null } | undefined;
    const monitor = await monitorPublishedSupplierProducts({
      store: { marketplaceListing: { findMany: vi.fn().mockResolvedValue([{ supplierProduct: { ...product, supplier } }]) } } as never,
      factory: providerFactory,
      importProducts: vi.fn(async (_supplierId, products) => {
        [monitoredProduct] = products;
        return { imported: products.length, historyCreated: 0, syncedAt: new Date(0) };
      }),
      logger,
      syncedAt: new Date('2026-09-28T18:00:00.000Z'),
    });
    expect(monitor).toMatchObject({ inspected: 1, succeeded: 1, failed: 0 });
    expect(monitoredProduct).toMatchObject({ cost: 25_000, stock: 15 });

    const publish = vi.fn();
    const linkListing = vi.fn();
    const publication = await publishSupplierProduct({
      supplierProductId: product.id,
      marketplaceAccountId: '84259783',
      marketplaceFee: 0,
      shippingCost: 0,
      taxes: 0,
      extraCosts: 0,
      targetMarginPercentage: 20,
      packageDimensions: { heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 },
    }, {
      findProduct: vi.fn().mockResolvedValue({ ...product, supplier, pricing: null }),
      publisher: { publish },
      linkListing,
      logger,
      minimumMarginPercentage: 20,
      minimumProfitAmount: 0,
      dryRun: true,
    });
    expect(publication).toMatchObject({ dryRun: true, listing: null, pricing: { netProfit: 6_250, marginPercentage: 20 } });
    expect(publish).not.toHaveBeenCalled();
    expect(linkListing).not.toHaveBeenCalled();

    const claimOrder = vi.fn();
    const manualFactory = new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register({
      key: 'mock-v1',
      capabilities: ['product'],
      builder: () => ({
        getProducts: vi.fn(), getProduct: vi.fn(), getStock: vi.fn(), getPrice: vi.fn(),
        createOrder: vi.fn(), getOrderStatus: vi.fn(),
      }),
    });
    let manualPurchase: unknown;
    const upsertOrder = vi.fn().mockResolvedValue({ id: 'internal-order-1' });
    const webhook = await processMercadoLibreNotification({
      _id: 'event-mvp-001',
      topic: 'orders_v2',
      resource: '/orders/ML-ORDER-1',
      user_id: '84259783',
      application_id: 'app-mvp',
    }, {
      expectedApplicationId: 'app-mvp',
      withLock: async (_key, task) => task(),
      reserveEvent: vi.fn().mockResolvedValue({ id: 'event-1', status: MarketplaceWebhookStatus.RECEIVED }),
      completeEvent: vi.fn().mockResolvedValue(undefined),
      failEvent: vi.fn(),
      client: { get: vi.fn().mockResolvedValue({
        id: 'ML-ORDER-1',
        status: 'paid',
        total_amount: publication.pricing.recommendedPrice,
        currency_id: 'ARS',
        order_items: [{ quantity: 1, item: { id: 'MLA-MVP-1' } }],
        payments: [{ status: 'approved' }],
        shipping: { status: 'ready_to_ship' },
        buyer: { id: 'buyer-mvp' },
      }) },
      findListing: vi.fn().mockResolvedValue({
        id: 'listing-mvp',
        supplierProduct: { id: product.id, supplierId: supplier.id, cost: product.cost },
      }),
      upsertOrder,
      submitSupplierOrder: async (orderId) => {
        manualPurchase = await createSupplierOrder(orderId, {
          automatic: true,
          dryRun: false,
          findOrder: vi.fn().mockResolvedValue({
            id: orderId,
            marketplaceOrderId: 'ML-ORDER-1',
            quantity: 1,
            shippingData: {},
            status: OrderStatus.PENDING,
            supplierOrderId: null,
            supplier,
            supplierProduct: product,
          }),
          claimOrder,
          factory: manualFactory,
          logger,
        });
        return manualPurchase;
      },
      logger,
    });
    expect(webhook).toEqual({ status: 'processed' });
    expect(upsertOrder).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceOrderId: 'ML-ORDER-1',
      supplierProductId: product.id,
      status: OrderStatus.PROCESSING,
      profit: 6_250,
    }));
    expect(manualPurchase).toEqual({ status: 'manual_required' });
    expect(claimOrder).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      'INFO', 'dropshipping_dry_run', 'Dry run: marketplace_publish', expect.objectContaining({ supplierProductId: product.id }),
    );
    expect(logger).toHaveBeenCalledWith(
      'WARN', 'supplier_order', 'Supplier order requires manual processing', expect.objectContaining({ orderId: 'internal-order-1' }),
    );
  });
});
