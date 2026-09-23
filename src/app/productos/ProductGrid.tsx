import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { productPath, safeAffiliateUrl } from '@/lib/product-url';
import { getProductCategory } from '@/lib/product-categories';

type PublicProduct = {
  id: string;
  title: string;
  displayTitle?: string | null;
  shortDescription?: string | null;
  category?: string | null;
  primaryImageUrl?: string | null;
  affiliateUrl?: string | null;
};

export default function ProductGrid({ products }: { products: PublicProduct[] }) {
  const publicProducts = products.filter((product) => safeAffiliateUrl(product.affiliateUrl ?? null));
  return <div className="product-grid">
    {publicProducts.map((product) => {
      const title = product.displayTitle || product.title;
      const category = product.category ? getProductCategory(product.category)?.name || product.category : null;
      return <article key={product.id} className="product-card">
        {product.primaryImageUrl && <Link href={productPath(product.id)}><img src={product.primaryImageUrl} alt={title} className="product-image" /></Link>}
        <div className="product-body">
          {category && <p className="product-category">{category}</p>}
          <h2><Link href={productPath(product.id)}>{title}</Link></h2>
          {product.shortDescription && <p className="product-summary">{product.shortDescription}</p>}
          <Link href={productPath(product.id)} className="product-link">
            Ver producto <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </article>;
    })}
    {publicProducts.length === 0 && <p className="catalog-empty">Estamos preparando una nueva selección para esta categoría.</p>}
  </div>;
}
