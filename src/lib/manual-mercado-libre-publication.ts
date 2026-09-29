import { marketplacePackageAttributes, SupplierPackageSchema } from './supplier-package';

type ManualPublicationSource = {
  sku?: string | null;
  title: string;
  description?: string | null;
  editorialTitle?: string | null;
  editorialDescription?: string | null;
  editorialStatus: string;
  images: string[];
  attributes?: unknown;
  stock?: number | null;
  pricing?: {
    finalPriceArs: number;
    marketplaceCategoryId?: string | null;
  } | null;
  package: {
    heightCm?: number;
    widthCm?: number;
    lengthCm?: number;
    weightGrams?: number;
  };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function valueName(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

export function buildManualMercadoLibrePublication(source: ManualPublicationSource) {
  if (source.editorialStatus !== 'APPROVED') throw new Error('El contenido debe aprobarse antes de preparar la publicación manual.');
  const sellerSku = source.sku?.trim();
  if (!sellerSku) throw new Error('SELLER_SKU es obligatorio para vincular la publicación.');
  if (!source.pricing || source.pricing.finalPriceArs <= 0) throw new Error('El precio final debe configurarse antes de publicar.');
  const packageData = SupplierPackageSchema.parse(source.package);
  const suggestedAttributes = Object.entries(record(source.attributes)).flatMap(([id, value]) => {
    if (id.startsWith('sellerPackage')) return [];
    const normalized = valueName(value);
    return normalized ? [{ id, value_name: normalized }] : [];
  });

  return {
    title: source.editorialTitle?.trim() || source.title.trim(),
    description: source.editorialDescription?.trim() || source.description?.trim() || '',
    categoryId: source.pricing.marketplaceCategoryId || null,
    priceArs: source.pricing.finalPriceArs,
    availableQuantity: Math.max(0, source.stock ?? 0),
    currencyId: 'ARS' as const,
    sellerSku,
    pictures: source.images.map((sourceUrl) => ({ source: sourceUrl })),
    attributes: [
      { id: 'SELLER_SKU', value_name: sellerSku },
      ...suggestedAttributes,
      ...marketplacePackageAttributes(packageData),
    ],
    package: packageData,
  };
}

export type ManualMercadoLibrePublication = ReturnType<typeof buildManualMercadoLibrePublication>;
