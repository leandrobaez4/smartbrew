import Link from 'next/link';
import { PRODUCT_CATEGORIES } from '@/lib/product-categories';

export default function CategoryNavigation() {
  return <>
    <nav className="desktop-nav" aria-label="Categorías de productos">
      {PRODUCT_CATEGORIES.map((category) => <Link key={category.slug} href={`/categorias/${category.slug}`}>{category.name}</Link>)}
    </nav>
    <details className="mobile-nav">
      <summary>Categorías</summary>
      <nav aria-label="Categorías de productos para mobile">
        {PRODUCT_CATEGORIES.map((category) => <Link key={category.slug} href={`/categorias/${category.slug}`}>{category.name}</Link>)}
        <Link href="/productos">Todos los productos</Link>
      </nav>
    </details>
  </>;
}
