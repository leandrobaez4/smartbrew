export type CatalogAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN';

type CatalogItemBase = {
  catalogKey: string;
  title: string;
  externalId: string | null;
  imageUrl: string | null;
  status: string;
  availability: CatalogAvailability;
  price: number | null;
  currency: string | null;
  updatedAt: Date;
  href: string;
};

export type AffiliateCatalogItem = CatalogItemBase & {
  sourceKind: 'AFFILIATE_MARKETPLACE';
  productId: string;
  marketplace: string;
  affiliateUrl: string | null;
};

export type SupplierCatalogItem = CatalogItemBase & {
  sourceKind: 'SUPPLIER';
  supplierProductId: string;
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  sku: string | null;
  stock: number | null;
  lastSyncAt: Date;
  listingStatus: string | null;
  priceKind: 'PUBLISHED' | 'CALCULATED' | null;
};

export type CatalogItem = AffiliateCatalogItem | SupplierCatalogItem;

export function affiliateCatalogItem(input: {
  id: string;
  title: string;
  externalId: string | null;
  marketplace: string;
  status: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
  updatedAt: Date;
}): AffiliateCatalogItem {
  return {
    catalogKey: `affiliate:${input.id}`,
    sourceKind: 'AFFILIATE_MARKETPLACE',
    productId: input.id,
    title: input.title,
    externalId: input.externalId,
    marketplace: input.marketplace,
    status: input.status,
    availability: 'UNKNOWN',
    price: input.price,
    currency: input.currency,
    imageUrl: input.imageUrl,
    affiliateUrl: input.affiliateUrl,
    updatedAt: input.updatedAt,
    href: `/admin/products/${input.id}`,
  };
}

export function supplierCatalogItem(input: {
  id: string;
  title: string;
  externalId: string;
  sku: string | null;
  active: boolean;
  stock: number | null;
  imageUrl: string | null;
  publishedPrice: number | null;
  calculatedPrice: number | null;
  currency: string | null;
  updatedAt: Date;
  lastSyncAt: Date;
  listingStatus: string | null;
  supplier: { id: string; name: string; slug: string; status: string };
}): SupplierCatalogItem {
  const published = input.publishedPrice != null;
  const calculated = input.calculatedPrice != null;
  return {
    catalogKey: `supplier:${input.id}`,
    sourceKind: 'SUPPLIER',
    supplierProductId: input.id,
    supplierId: input.supplier.id,
    supplierName: input.supplier.name,
    supplierSlug: input.supplier.slug,
    title: input.title,
    externalId: input.externalId,
    sku: input.sku,
    status: !input.active ? 'INACTIVE' : input.supplier.status,
    availability: input.stock == null ? 'UNKNOWN' : input.stock > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
    stock: input.stock,
    price: published ? input.publishedPrice : input.calculatedPrice,
    priceKind: published ? 'PUBLISHED' : calculated ? 'CALCULATED' : null,
    currency: input.currency,
    imageUrl: input.imageUrl,
    updatedAt: input.updatedAt,
    lastSyncAt: input.lastSyncAt,
    listingStatus: input.listingStatus,
    href: `/admin/opportunities/${input.id}`,
  };
}

export function mergeCatalogItems(affiliateItems: AffiliateCatalogItem[], supplierItems: SupplierCatalogItem[]) {
  return [...affiliateItems, ...supplierItems].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
