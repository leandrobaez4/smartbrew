import Image from "next/image";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Cable,
  Coffee,
  Cpu,
  Gauge,
  Headphones,
  House,
  SearchCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import CategoryNavigation from './CategoryNavigation';
import ProductGrid from '@/app/productos/ProductGrid';
import {
  HOME_FEATURED_COLLECTION_SLUG,
  loadHomeFeaturedProducts,
} from '@/lib/home-featured';

export const dynamic = 'force-dynamic';

const db = new PrismaClient();

const categories = [
  {
    number: "01",
    slug: "cafe",
    icon: Coffee,
    title: "Café",
    description:
      "Productos y accesorios para preparar, servir y disfrutar un mejor café.",
    tone: "cyan",
  },
  {
    number: "02",
    slug: "tecnologia",
    icon: Cpu,
    title: "Tecnología",
    description:
      "Dispositivos y herramientas que mejoran tu día, elegidos por utilidad real.",
    tone: "cyan",
  },
  {
    number: "03",
    slug: "gadgets",
    icon: Cable,
    title: "Gadgets",
    description:
      "Accesorios inteligentes, prácticos y distintos para sumar a tu rutina.",
    tone: "copper",
  },
  {
    number: "04",
    slug: "smart-home",
    icon: House,
    title: "Smart Home",
    description:
      "Tecnología útil para hacer tu casa más cómoda, simple y conectada.",
    tone: "copper",
  },
];

async function getFeaturedProducts() {
  return loadHomeFeaturedProducts(async () => {
    const collection = await db.collection.findFirst({
      where: { slug: HOME_FEATURED_COLLECTION_SLUG, published: true },
      select: {
        products: {
          where: { product: { status: 'ACTIVE', affiliateUrl: { not: null } } },
          orderBy: { position: 'asc' },
          take: 8,
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

    return collection?.products.map(({ product }) => product) ?? [];
  });
}

export default async function Home() {
  const featuredProducts = await getFeaturedProducts();

  return (
    <main className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="SmartBrew, inicio">
          <Image src="/smartbrew-logo.png" alt="" width={52} height={52} className="brand-mark" priority />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>

        <CategoryNavigation />

        <Link href="/productos" className="header-cta">
          Ver selección <ArrowUpRight aria-hidden="true" size={17} />
        </Link>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot" />Coffee &amp; technology</div>
          <h1 id="hero-title">Tecnología que activa <span>tu día.</span></h1>
          <p>
            Seleccionamos productos tech, gadgets y accesorios de café que hacen
            más simples, conectados y disfrutables tus momentos cotidianos.
          </p>
          <div className="hero-actions">
            <a href="#recomendados" className="button button-primary">
              Ver recomendados <ArrowRight aria-hidden="true" size={19} />
            </a>
            <Link href="/categorias/cafe" className="button button-ghost">
              Explorar café
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-label="SmartBrew, café y tecnología">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="signal-chip chip-top"><Sparkles aria-hidden="true" size={16} /> Curaduría inteligente</div>
          <div className="signal-chip chip-bottom"><Gauge aria-hidden="true" size={16} /> Elegidos para tu rutina</div>
          <div className="logo-stage">
            <Image src="/smartbrew-logo.png" alt="Logo de SmartBrew" width={1024} height={1024} className="hero-logo" priority />
          </div>
        </div>

        <div className="hero-index" aria-hidden="true">
          <span>SB / 01</span>
          <span>Buenos Aires · Argentina</span>
        </div>
      </section>

      <section className="statement" aria-label="Propuesta SmartBrew">
        <span className="statement-label">Nuestra mirada</span>
        <p>Cuando la tecnología se encuentra con el ritual del café, lo cotidiano se vuelve <em>extraordinario.</em></p>
      </section>

      <section className="categories section-pad" id="categorias">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Lo que elegimos</span>
            <h2>Explorá SmartBrew.</h2>
          </div>
          <p>
            Menos ruido, mejores elecciones. Reunimos productos que combinan
            diseño, funcionalidad y una buena experiencia de uso.
          </p>
        </div>

        <div className="category-grid">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <article className={`category-card category-${category.tone}`} key={category.title}>
                <div className="category-topline">
                  <span>{category.number}</span>
                  <Icon aria-hidden="true" size={28} strokeWidth={1.6} />
                </div>
                <div>
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                </div>
                <Link href={`/categorias/${category.slug}`} aria-label={`Ver productos de ${category.title}`}>
                  Ver productos <ArrowUpRight aria-hidden="true" size={18} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="recommendations section-pad" id="recomendados" aria-labelledby="recommendations-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Selección editorial</span>
            <h2 id="recommendations-title">Recomendados SmartBrew.</h2>
          </div>
          <p>
            Una selección breve de productos que se destacan por utilidad,
            diseño y experiencia de uso.
          </p>
        </div>
        {featuredProducts.length ? (
          <ProductGrid products={featuredProducts} />
        ) : (
          <div className="recommendations-empty">
            <p>Estamos preparando nuestra próxima selección recomendada.</p>
            <Link href="/productos" className="product-link">
              Explorar todos los productos <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          </div>
        )}
      </section>

      <section className="selection-process section-pad" aria-labelledby="selection-process-title">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Transparencia</span>
            <h2 id="selection-process-title">Cómo elegimos.</h2>
          </div>
          <p>
            Investigamos cada recomendación y explicamos con claridad cómo
            funciona nuestra relación de afiliados.
          </p>
        </div>
        <div className="selection-process-grid">
          <article>
            <SearchCheck aria-hidden="true" size={28} />
            <span>01</span>
            <h3>Seleccionamos con criterio</h3>
            <p>Priorizamos utilidad real, calidad, buenas reseñas y una experiencia de uso clara.</p>
          </article>
          <article>
            <ShoppingBag aria-hidden="true" size={28} />
            <span>02</span>
            <h3>Comprás en Mercado Libre</h3>
            <p>El enlace te lleva al sitio del vendedor, donde revisás precio, envío y condiciones antes de comprar.</p>
          </article>
          <article>
            <BadgeDollarSign aria-hidden="true" size={28} />
            <span>03</span>
            <h3>Podemos recibir una comisión</h3>
            <p>Si comprás desde un enlace afiliado, SmartBrew puede recibir una comisión sin costo adicional para vos.</p>
          </article>
        </div>
      </section>

      <section className="about section-pad" id="nosotros">
        <div className="about-mark" aria-hidden="true">SB</div>
        <div className="about-copy">
          <span className="section-kicker">Somos SmartBrew</span>
          <h2>Productos con sentido para una vida más conectada.</h2>
          <p className="about-lead">
            Somos una empresa argentina dedicada a acercarte tecnología,
            gadgets y accesorios para el café seleccionados con criterio.
          </p>
          <p>
            Buscamos soluciones que se integren de forma natural a tu vida:
            desde ese accesorio que ordena tu espacio hasta la herramienta que
            transforma tu próxima taza.
          </p>
          <div className="values">
            <div><ShieldCheck aria-hidden="true" size={21} /><span>Selección confiable</span></div>
            <div><Headphones aria-hidden="true" size={21} /><span>Cercanía y atención</span></div>
          </div>
        </div>
      </section>

      <section className="closing-cta section-pad">
        <div>
          <span className="section-kicker">Descubrí algo nuevo</span>
          <h2>Tu próximo favorito puede estar acá.</h2>
        </div>
        <Link href="/productos" className="button button-light">
          Ver todos los productos <ArrowRight aria-hidden="true" size={19} />
        </Link>
      </section>

      <footer className="site-footer">
        <Link href="/" className="brand" aria-label="SmartBrew, inicio">
          <Image src="/smartbrew-logo.png" alt="" width={44} height={44} className="brand-mark" />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>
        <p>Tecnología, gadgets y café para disfrutar todos los días.</p>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SmartBrew</span>
          <div className="footer-links">
            <Link href="/politica-de-privacidad">Política de privacidad</Link>
            <span>Coffee &amp; Technology</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
