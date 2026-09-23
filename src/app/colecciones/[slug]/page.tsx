import type { Metadata } from 'next';
import { PrismaClient } from '@prisma/client';
import { cache } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import ProductGrid from '@/app/productos/ProductGrid';
import { buildCollectionMetadata, safeCollectionImage } from '@/lib/collection-public';
import { safeAffiliateUrl } from '@/lib/product-url';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const getPublishedCollection = cache(async (slug: string) => {
  if (!validSlug(slug)) return null;
  return db.collection.findFirst({
    where: { slug, published: true },
    select: {
      slug: true,
      title: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      image: true,
      products: {
        where: { product: { status: 'ACTIVE', affiliateUrl: { not: null } } },
        orderBy: { position: 'asc' },
        select: {
          product: {
            select: {
              id: true,
              title: true,
              displayTitle: true,
              shortDescription: true,
              category: true,
              primaryImageUrl: true,
              affiliateUrl: true,
            },
          },
        },
      },
    },
  });
});

type CollectionPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getPublishedCollection(slug);
  if (!collection) notFound();
  return buildCollectionMetadata(collection);
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getPublishedCollection(slug);
  if (!collection) notFound();

  const products = collection.products
    .map(({ product }) => product)
    .filter((product) => safeAffiliateUrl(product.affiliateUrl));
  const image = safeCollectionImage(collection.image);

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <Link href="/" className="brand" aria-label="Volver a SmartBrew">
          <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>
      </header>

      <main className="catalog-main collection-main">
        <Link href="/productos" className="section-kicker"><ArrowLeft aria-hidden="true" size={15} /> Ver todos los productos</Link>
        <section className={`collection-hero ${image ? 'collection-hero-with-image' : ''}`}>
          <div>
            <p className="collection-label">Colección editorial</p>
            <h1>{collection.title}</h1>
            {collection.description ? <p className="catalog-intro">{collection.description}</p> : null}
          </div>
          {image ? (
            // Collection images are editor-controlled absolute HTTPS URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={collection.title} className="collection-image" />
          ) : null}
        </section>

        <section aria-labelledby="collection-products-title">
          <div className="collection-products-heading">
            <h2 id="collection-products-title">Productos seleccionados</h2>
            <span>{products.length} {products.length === 1 ? 'producto' : 'productos'}</span>
          </div>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <p className="catalog-empty">Estamos preparando los productos de esta colección. Volvé pronto para conocer la selección.</p>
          )}
        </section>
      </main>

      <footer className="catalog-footer">
        <p>Algunos enlaces son de afiliado. Podemos recibir una comisión si comprás, sin costo adicional para vos.</p>
        <Link href="/politica-de-privacidad">Política de privacidad</Link>
      </footer>
    </div>
  );
}

