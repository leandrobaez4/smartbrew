import type { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getProductCategory, PRODUCT_CATEGORIES } from '@/lib/product-categories';
import ProductGrid from '@/app/productos/ProductGrid';

export const dynamic = 'force-dynamic';
const db = new PrismaClient();

type CategoryPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PRODUCT_CATEGORIES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const category = getProductCategory((await params).slug);
  if (!category) return {};
  const title = `${category.name}: productos recomendados | SmartBrew`;
  return {
    title,
    description: category.description,
    alternates: { canonical: `/categorias/${category.slug}` },
    openGraph: {
      title,
      description: category.description,
      type: 'website',
      url: `/categorias/${category.slug}`,
    },
  };
}

async function getCategoryProducts(category: string) {
  try {
    return await db.product.findMany({
      where: { category, status: 'ACTIVE', affiliateUrl: { not: null } },
      select: { id: true, title: true, displayTitle: true, primaryImageUrl: true, affiliateUrl: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    return [];
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const category = getProductCategory((await params).slug);
  if (!category) notFound();
  const products = await getCategoryProducts(category.slug);
  return <div className="catalog-page">
    <header className="catalog-header">
      <Link href="/" className="brand" aria-label="Volver a SmartBrew">
        <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
        <span className="brand-name"><strong>Smart</strong>Brew</span>
      </Link>
    </header>
    <main className="catalog-main">
      <Link href="/productos" className="section-kicker"><ArrowLeft aria-hidden="true" size={15} /> Ver todos los productos</Link>
      <h1>{category.name}</h1>
      <p className="catalog-intro">{category.description}</p>
      <ProductGrid products={products} />
    </main>
    <footer className="catalog-footer">
      <p>Algunos enlaces son de afiliado. Podemos recibir una comisión si comprás, sin costo adicional para vos.</p>
      <Link href="/politica-de-privacidad">Política de privacidad</Link>
    </footer>
  </div>;
}
