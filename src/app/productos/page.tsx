import { PrismaClient } from "@prisma/client";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

async function getPublicProducts() {
  try {
    return await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        affiliateUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export default async function ProductosPage() {
  const products = await getPublicProducts();

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

        <div className="product-grid">
          {products.map((product) => (
            <article key={product.id} className="product-card">
              {product.primaryImageUrl && (
                <img src={product.primaryImageUrl} alt={product.title} className="product-image" />
              )}
              <div className="product-body">
                <h2>{product.title}</h2>
                <p className="product-price">${product.price?.toString()} {product.currencyId}</p>
                <a href={product.affiliateUrl!} target="_blank" rel="noopener noreferrer sponsored" className="product-link">
                  Ver en Mercado Libre <ArrowUpRight aria-hidden="true" size={18} />
                </a>
              </div>
            </article>
          ))}

          {products.length === 0 && (
            <p className="catalog-empty">
              Estamos preparando una nueva selección. Volvé pronto para descubrir nuestros recomendados.
            </p>
          )}
        </div>
      </main>

      <footer className="catalog-footer">
        <p>
          Algunos enlaces son de afiliado. Podemos recibir una comisión si comprás, sin costo adicional para vos.
          Los precios y la disponibilidad pueden cambiar en Mercado Libre.
        </p>
      </footer>
    </div>
  );
}
