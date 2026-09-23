import { PrismaClient } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ProductGrid from './ProductGrid';
import { PRODUCT_CATEGORIES } from '@/lib/product-categories';
import { filterPublicProducts } from '@/lib/product-search';

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

type PublicProduct = {
  id: string;
  title: string;
  originalTitle: string | null;
  displayTitle: string | null;
  shortDescription: string | null;
  category: string | null;
  tags: string[];
  primaryImageUrl: string | null;
  affiliateUrl: string | null;
};

type ProductSearchParams = { q?: string | string[]; categoria?: string | string[] };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

async function getPublicProducts() {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        affiliateUrl: { not: null },
      },
      select: {
        id: true,
        title: true,
        originalTitle: true,
        displayTitle: true,
        shortDescription: true,
        category: true,
        tags: true,
        primaryImageUrl: true,
        affiliateUrl: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { products, failed: false };
  } catch {
    return { products: [] as PublicProduct[], failed: true };
  }
}

export default async function ProductosPage({ searchParams }: { searchParams?: Promise<ProductSearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const query = firstParam(params.q).trim();
  const requestedCategory = firstParam(params.categoria);
  const category = PRODUCT_CATEGORIES.some(({ slug }) => slug === requestedCategory) ? requestedCategory : '';
  const { products, failed } = await getPublicProducts();
  const visibleProducts = filterPublicProducts(products, query, category);

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <Link href="/" className="brand" aria-label="Volver a SmartBrew">
          <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>
      </header>

      <main className="catalog-main">
        <Link href="/" className="section-kicker">
          <ArrowLeft aria-hidden="true" size={15} /> Volver al inicio
        </Link>
        <h1>Hallazgos para una vida más smart.</h1>
        <p className="catalog-intro">
          Nuestra selección de tecnología, gadgets y accesorios de café.
          Productos elegidos por su utilidad, diseño y experiencia.
        </p>

        <form className="catalog-filters" action="/productos" method="get" role="search">
          <label className="catalog-search">
            <span>Buscar productos</span>
            <input name="q" type="search" defaultValue={query} placeholder="Ej. cafetera, auriculares o escritorio" />
          </label>
          <label className="catalog-category-filter">
            <span>Categoría</span>
            <select name="categoria" defaultValue={category}>
              <option value="">Todas las categorías</option>
              {PRODUCT_CATEGORIES.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
            </select>
          </label>
          <button type="submit">Aplicar filtros</button>
          {(query || category) && <Link href="/productos" className="catalog-clear">Limpiar</Link>}
        </form>

        {failed
          ? <p className="catalog-empty" role="alert">No pudimos cargar los productos. Intentá nuevamente en unos minutos.</p>
          : <>
            <p className="catalog-results" aria-live="polite">
              {visibleProducts.length} {visibleProducts.length === 1 ? 'producto encontrado' : 'productos encontrados'}
            </p>
            <ProductGrid products={visibleProducts} />
          </>}
      </main>

      <footer className="catalog-footer">
        <p>
          Algunos enlaces son de afiliado. Podemos recibir una comisión si comprás, sin costo adicional para vos.
          Los precios y la disponibilidad pueden cambiar en Mercado Libre.
        </p>
        <Link href="/politica-de-privacidad">Política de privacidad</Link>
      </footer>
    </div>
  );
}
