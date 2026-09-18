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

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) notFound();
  const product = await db.product.findFirst({
    where: { id, status: 'ACTIVE', affiliateUrl: { not: null } },
    select: { title: true, affiliateUrl: true, primaryImageUrl: true, imageUrls: true },
  });
  if (!product) notFound();
  const affiliateUrl = safeAffiliateUrl(product.affiliateUrl);
  if (!affiliateUrl) notFound();
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
        <ProductGallery images={images} title={product.title} />
        <section className="single-details">
          <span className="section-kicker">Selección SmartBrew</span>
          <h1>{product.title}</h1>
          <p>Consultá las características, variantes y condiciones de compra de este producto en Mercado Libre.</p>
          <a className="single-buy" href={affiliateUrl} target="_blank" rel="noopener noreferrer sponsored">Comprar en Mercado Libre <ArrowUpRight size={20} /></a>
          <p className="single-note">Vas a salir de SmartBrew. La compra, el pago y el envío se gestionan en Mercado Libre. Consultá allí el precio y la disponibilidad actualizados.</p>
          <div className="single-disclosure">Enlace de afiliado: podemos recibir una comisión por tu compra, sin costo adicional para vos.</div>
        </section>
      </div>
    </main>
    <footer className="catalog-footer"><p>SmartBrew · Tecnología, gadgets y café.</p><Link href="/politica-de-privacidad">Política de privacidad</Link></footer>
  </div>;
}
