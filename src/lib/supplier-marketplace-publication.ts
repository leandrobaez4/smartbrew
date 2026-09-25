import { MarketplaceListingStatus, Prisma, Supplier, SupplierProduct, SupplierProductEditorialStatus, SupplierProductPricing } from '@prisma/client';
import { dropshippingDryRunEnabled, logDryRunAction } from './dropshipping-dry-run';
import { logSystemEvent } from './logger';
import { linkMarketplaceListing, synchronizeMarketplaceListing } from './marketplace-listings';
import {
  MarketplacePublicationError,
  MarketplacePublisher,
  MercadoLibrePublisher,
} from './mercado-libre-publisher';
import { portalDb } from './portal';
import { PricingService } from './pricing';

type ProductWithSupplier = SupplierProduct & { supplier: Supplier; pricing?: SupplierProductPricing | null };

export type PublishSupplierProductInput = {
  supplierProductId: string;
  marketplaceAccountId: string;
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  extraCosts: number;
  targetMarginPercentage: number;
};

type PublicationDependencies = {
  findProduct?: (id: string) => Promise<ProductWithSupplier | null>;
  publisher?: MarketplacePublisher;
  linkListing?: typeof linkMarketplaceListing;
  syncListing?: typeof synchronizeMarketplaceListing;
  failListing?: (listingId: string, marketplaceItemId?: string) => Promise<unknown>;
  logger?: typeof logSystemEvent;
  minimumMarginPercentage?: number;
  minimumProfitAmount?: number;
  dryRun?: boolean;
};

function configNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be numeric`);
  return value;
}

function attributes(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([id, raw]) => {
    if (!/^[A-Z0-9_]{1,64}$/i.test(id) || !['string', 'number', 'boolean'].includes(typeof raw)) return [];
    return [{ id, value_name: String(raw) }];
  });
}

function validImages(images: string[]) {
  return [...new Set(images)].filter((image) => {
    try {
      return new URL(image).protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function validateProduct(product: ProductWithSupplier) {
  if (product.supplier.status !== 'ACTIVE') throw new Error('El proveedor no está activo.');
  if (!product.active) throw new Error('El producto del proveedor no está activo.');
  if ((product.stock ?? 0) <= 0) throw new Error('El producto no tiene stock.');
  if (product.cost == null || Number(product.cost) < 0) throw new Error('El producto no tiene un costo válido.');
  if (!product.title.trim()) throw new Error('El producto no tiene título.');
  if (!product.description?.trim()) throw new Error('El producto no tiene descripción.');
  const marketplaceCategoryId = product.pricing?.marketplaceCategoryId || product.category;
  if (!marketplaceCategoryId?.trim() || !/^MLA\d+$/.test(marketplaceCategoryId.trim())) {
    throw new Error('El producto no tiene una categoría válida de Mercado Libre.');
  }
  if (!product.currency?.trim()) throw new Error('El producto no tiene moneda.');
  if (!validImages(product.images).length) throw new Error('El producto no tiene imágenes HTTPS válidas.');
  if (product.editorialStatus !== SupplierProductEditorialStatus.APPROVED) {
    throw new Error('El contenido del producto debe revisarse y aprobarse antes de publicar.');
  }
  if (!product.editorialTitle?.trim() || !product.editorialDescription?.trim()) {
    throw new Error('El contenido editorial aprobado está incompleto.');
  }
}

export async function publishSupplierProduct(
  input: PublishSupplierProductInput,
  dependencies: PublicationDependencies = {},
) {
  const findProduct = dependencies.findProduct || ((id: string) => portalDb.supplierProduct.findUnique({
    where: { id },
    include: { supplier: true, pricing: true },
  }));
  const publisher = dependencies.publisher || new MercadoLibrePublisher();
  const linkListing = dependencies.linkListing || linkMarketplaceListing;
  const syncListing = dependencies.syncListing || synchronizeMarketplaceListing;
  const failListing = dependencies.failListing || ((listingId: string, marketplaceItemId?: string) => portalDb.marketplaceListing.update({
    where: { id: listingId },
    data: {
      status: MarketplaceListingStatus.ERROR,
      lastSyncAt: new Date(),
      ...(marketplaceItemId ? { marketplaceItemId } : {}),
    },
  }));
  const logger = dependencies.logger || logSystemEvent;
  let listingId: string | undefined;

  try {
    const product = await findProduct(input.supplierProductId);
    if (!product) throw new Error('No existe el producto del proveedor.');
    validateProduct(product);
    const marketplaceCategoryId = (product.pricing?.marketplaceCategoryId || product.category)!.trim();
    const pricing = product.pricing ? {
      recommendedPrice: Number(product.pricing.finalPriceArs),
      appliedMarginPercentage: Number(product.pricing.targetMarginPercentage),
      netProfit: Number(product.pricing.targetProfitArs),
      marginPercentage: Number(product.pricing.targetMarginPercentage),
      roi: Number(product.pricing.totalCostArs) > 0
        ? Number(product.pricing.targetProfitArs) / Number(product.pricing.totalCostArs) * 100
        : 0,
    } : new PricingService({
      minimumMarginPercentage: dependencies.minimumMarginPercentage
        ?? configNumber('MINIMUM_PROFIT_PERCENTAGE', 20),
      minimumProfitAmount: dependencies.minimumProfitAmount
        ?? configNumber('MINIMUM_PROFIT_AMOUNT', 0),
    }).calculate({
      supplierCost: Number(product.cost),
      marketplaceFee: input.marketplaceFee,
      shippingCost: input.shippingCost,
      taxes: input.taxes,
      extraCosts: input.extraCosts,
      targetMarginPercentage: input.targetMarginPercentage,
    });
    if (pricing.netProfit < 0) throw new Error('El producto no alcanza la rentabilidad mínima.');

    if (dependencies.dryRun ?? dropshippingDryRunEnabled()) {
      await logDryRunAction('marketplace_publish', {
        supplierProductId: product.id,
        supplierId: product.supplier.id,
        marketplaceAccountId: input.marketplaceAccountId,
        price: pricing.recommendedPrice,
        quantity: product.stock,
      }, logger);
      return { listing: null, pricing, dryRun: true as const };
    }

    const listing = await linkListing({
      supplierProductId: product.id,
      marketplace: 'MERCADO_LIBRE',
      marketplaceAccountId: input.marketplaceAccountId,
      price: pricing.recommendedPrice,
    });
    listingId = listing.id;
    if (listing.marketplaceItemId && listing.status === MarketplaceListingStatus.ACTIVE) {
      throw new Error('El producto ya está publicado en esta cuenta.');
    }

    const publication = await publisher.publish({
      title: product.editorialTitle!.trim(),
      description: product.editorialDescription!.trim(),
      categoryId: marketplaceCategoryId,
      price: pricing.recommendedPrice,
      currencyId: product.currency!.trim(),
      quantity: product.stock!,
      images: validImages(product.images),
      attributes: attributes(product.attributes),
    });
    const synchronized = await syncListing({
      listingId: listing.id,
      marketplaceItemId: publication.marketplaceItemId,
      status: MarketplaceListingStatus.ACTIVE,
      price: pricing.recommendedPrice,
    });
    await logger('INFO', 'mercado_libre_publication', 'Supplier product published', {
      supplierProductId: product.id,
      listingId: listing.id,
      marketplaceItemId: publication.marketplaceItemId,
      price: pricing.recommendedPrice,
      marginPercentage: pricing.marginPercentage,
    });
    return { listing: synchronized, pricing };
  } catch (error) {
    const marketplaceItemId = error instanceof MarketplacePublicationError ? error.marketplaceItemId : undefined;
    if (listingId) await failListing(listingId, marketplaceItemId);
    const message = error instanceof Error ? error.message : 'No se pudo publicar en Mercado Libre.';
    await logger('ERROR', 'mercado_libre_publication', 'Supplier product publication failed', {
      supplierProductId: input.supplierProductId,
      listingId,
      marketplaceItemId,
      error: message,
    });
    throw error;
  }
}
