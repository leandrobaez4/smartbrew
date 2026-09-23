import { PrismaClient } from '@prisma/client';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { mergeProductImages } from '@/lib/product-gallery';
import { safeAffiliateUrl } from '@/lib/product-url';
import ProductGallery from './ProductGallery';

export const dynamic = 'force-dynamic';
const db = new PrismaClient();

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function formatPrice(price: unknown, currencyId: string | null) {
  if (price === null || price === undefined) return null;
  const amount = Number(price);
  if (!Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currencyId || 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currencyId || '$'} ${amount.toLocaleString('es-AR')}`;
  }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) notFound();
  const product = await db.product.findFirst({
    where: { id, status: 'ACTIVE', affiliateUrl: { not: null } },
    select: {
      title: true,
      originalTitle: true,
      originalDescription: true,
      displayTitle: true,
      shortDescription: true,
      description: true,
      whyWePickedIt: true,
      idealFor: true,
      highlights: true,
      price: true,
      currencyId: true,
      affiliateUrl: true,
      primaryImageUrl: true,
      imageUrls: true,
    },
  });
  if (!product) notFound();
  const affiliateUrl = safeAffiliateUrl(product.affiliateUrl);
  if (!affiliateUrl) notFound();
  const displayTitle = product.displayTitle || product.originalTitle || product.title;
  const shortDescription = product.shortDescription || product.originalDescription;
  const description = product.description || product.originalDescription;
  const reasons = stringList(product.whyWePickedIt);
  const highlights = stringList(product.highlights);
  const price = formatPrice(product.price, product.currencyId);
  const images = mergeProductImages(product.primaryImageUrl ? [product.primaryImageUrl] : [], product.imageUrls);
  return <div className="catalog-page">
    <header className="catalog-header">
      <Link href="/" className="brand" aria-label="Volver a SmartBrew">
        <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
        <span className="brand-name"><strong>Smart</strong>Brew</span>
      </Link>
    </header>
    <main className="catalog-main single-main">
      <Link href="/productos" className="section-kicker"><ArrowLeft size={15} /> Ver todos los productos</Link>
      <div className="single-layout">
        <ProductGallery images={images} title={displayTitle} />
        <section className="single-details">
          <span className="section-kicker">Selección SmartBrew</span>
          <h1>{displayTitle}</h1>
          {shortDescription && <p className="single-lead">{shortDescription}</p>}
          {price && <p className="single-price">{price}</p>}
          <a className="single-buy" href={affiliateUrl} target="_blank" rel="noopener noreferrer sponsored">Ver precio en Mercado Libre <ArrowUpRight size={20} /></a>
          <p className="single-note">La compra se realiza en Mercado Libre. Allí se gestionan el pago, el envío, el precio y la disponibilidad.</p>
          <div className="single-disclosure">Enlace de afiliado: podemos recibir una comisión por tu compra, sin costo adicional para vos.</div>
        </section>
      </div>
      {(description || reasons.length || product.idealFor || highlights.length) && <div className="single-editorial">
        {description && <section>
          <span className="section-kicker">La recomendación</span>
          <h2>Descripción</h2>
          <p>{description}</p>
        </section>}
        {reasons.length > 0 && <section>
          <span className="section-kicker">Criterio editorial</span>
          <h2>Por qué lo elegimos</h2>
          <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>}
        {product.idealFor && <section>
          <span className="section-kicker">Uso recomendado</span>
          <h2>Ideal para</h2>
          <p>{product.idealFor}</p>
        </section>}
        {highlights.length > 0 && <section>
          <span className="section-kicker">Lo importante</span>
          <h2>Características destacadas</h2>
          <ul>{highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
        </section>}
      </div>}
    </main>
    <footer className="catalog-footer"><p>SmartBrew · Tecnología, gadgets y café.</p><Link href="/politica-de-privacidad">Política de privacidad</Link></footer>
  </div>;
}
