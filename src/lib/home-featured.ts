import { safeAffiliateUrl } from './product-url';

export const HOME_FEATURED_COLLECTION_SLUG = 'recomendados-smartbrew';
export const HOME_FEATURED_PRODUCT_LIMIT = 8;

export type HomeFeaturedProduct = {
  id: string;
  title: string;
  displayTitle?: string | null;
  shortDescription?: string | null;
  category?: string | null;
  primaryImageUrl?: string | null;
  affiliateUrl?: string | null;
};

export function selectHomeFeaturedProducts(products: HomeFeaturedProduct[]) {
  return products
    .filter((product) => safeAffiliateUrl(product.affiliateUrl ?? null))
    .slice(0, HOME_FEATURED_PRODUCT_LIMIT);
}

export async function loadHomeFeaturedProducts(
  fetchProducts: () => Promise<HomeFeaturedProduct[]>,
) {
  try {
    return selectHomeFeaturedProducts(await fetchProducts());
  } catch {
    return [];
  }
}
