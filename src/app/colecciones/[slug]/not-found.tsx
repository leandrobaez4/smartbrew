import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CollectionNotFound() {
  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <Link href="/" className="brand" aria-label="Volver a SmartBrew">
          <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>
      </header>
      <main className="catalog-main collection-not-found">
        <p className="section-kicker">Colección no encontrada</p>
        <h1>Esta selección no está disponible.</h1>
        <p className="catalog-intro">Puede que todavía no esté publicada o que su dirección haya cambiado.</p>
        <Link href="/productos" className="product-link"><ArrowLeft aria-hidden="true" size={18} /> Explorar productos</Link>
      </main>
    </div>
  );
}

