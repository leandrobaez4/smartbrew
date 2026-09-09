import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Cable,
  Coffee,
  Cpu,
  Gauge,
  Headphones,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const categories = [
  {
    number: "01",
    icon: Cpu,
    title: "Tecnología",
    description:
      "Dispositivos y herramientas que mejoran tu día, elegidos por utilidad real.",
    tone: "cyan",
  },
  {
    number: "02",
    icon: Cable,
    title: "Gadgets",
    description:
      "Accesorios inteligentes, prácticos y distintos para sumar a tu rutina.",
    tone: "copper",
  },
  {
    number: "03",
    icon: Coffee,
    title: "Café",
    description:
      "Productos y accesorios para preparar, servir y disfrutar un mejor café.",
    tone: "cyan",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="SmartBrew, inicio">
          <Image src="/smartbrew-logo.png" alt="" width={52} height={52} className="brand-mark" priority />
          <span className="brand-name"><strong>Smart</strong>Brew</span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegación principal">
          <a href="#categorias">Categorías</a>
          <a href="#nosotros">Nosotros</a>
          <Link href="/productos">Productos</Link>
        </nav>

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
            <Link href="/productos" className="button button-primary">
              Explorar productos <ArrowRight aria-hidden="true" size={19} />
            </Link>
            <a href="#nosotros" className="button button-ghost">Conocé SmartBrew</a>
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
            <h2>Un universo para curiosos.</h2>
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
                <Link href="/productos" aria-label={`Ver productos de ${category.title}`}>
                  Ver productos <ArrowUpRight aria-hidden="true" size={18} />
                </Link>
              </article>
            );
          })}
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
