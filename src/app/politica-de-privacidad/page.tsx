import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de privacidad | SmartBrew",
  description:
    "Información sobre cómo SmartBrew recopila, utiliza y protege los datos personales.",
};

const sections = [
  {
    id: "datos-que-tratamos",
    title: "1. Datos que tratamos",
    content: (
      <>
        <p>
          Cuando interactuás con SmartBrew a través de Instagram, podemos recibir
          datos que Meta pone a disposición de la aplicación, como tu identificador
          de usuario, nombre de usuario, comentarios, mensajes, identificadores de
          publicaciones y la fecha y hora de la interacción.
        </p>
        <p>
          También podemos registrar información técnica necesaria para operar y
          proteger el servicio, como el estado de entrega de los eventos, códigos de
          error y registros de actividad. No solicitamos contraseñas de Instagram ni
          datos de pago.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "2. Para qué usamos los datos",
    content: (
      <>
        <p>Utilizamos la información únicamente para:</p>
        <ul>
          <li>detectar comentarios o mensajes que soliciten información;</li>
          <li>identificar el producto relacionado con una publicación;</li>
          <li>responder por Instagram con información y enlaces solicitados;</li>
          <li>administrar publicaciones y moderar interacciones;</li>
          <li>diagnosticar errores, prevenir abusos y mantener la seguridad.</li>
        </ul>
        <p>
          No vendemos datos personales ni los utilizamos para elaborar perfiles de
          publicidad basada en información sensible.
        </p>
      </>
    ),
  },
  {
    id: "meta",
    title: "3. Integración con Meta e Instagram",
    content: (
      <p>
        SmartBrew utiliza la API de Instagram proporcionada por Meta para publicar
        contenido, recibir eventos de comentarios y mensajes, y responder a esas
        interacciones. El uso de Instagram también está sujeto a las condiciones y
        políticas de privacidad de Meta. Solo accedemos a los permisos necesarios
        para estas funciones.
      </p>
    ),
  },
  {
    id: "proveedores",
    title: "4. Proveedores y transferencias",
    content: (
      <p>
        Para operar el servicio podemos utilizar proveedores de infraestructura,
        alojamiento, base de datos y procesamiento de tareas, incluidos Meta,
        Vercel y Upstash/QStash. Estos proveedores pueden procesar información en
        otros países y actúan bajo sus propias condiciones de seguridad y
        privacidad. Solo compartimos los datos necesarios para prestar el servicio
        o cumplir una obligación legal.
      </p>
    ),
  },
  {
    id: "afiliados",
    title: "5. Enlaces de afiliados",
    content: (
      <p>
        Algunos mensajes y páginas contienen enlaces de afiliados de terceros, como
        Mercado Libre. Si realizás una compra mediante esos enlaces, SmartBrew puede
        recibir una comisión sin costo adicional para vos. Al abrir un enlace,
        pasás al sitio del tercero y se aplican sus propias políticas. SmartBrew no
        recibe ni almacena los datos de pago de esas compras.
      </p>
    ),
  },
  {
    id: "conservacion",
    title: "6. Conservación y seguridad",
    content: (
      <p>
        Conservamos los datos y registros durante el tiempo necesario para operar,
        solucionar incidentes y cumplir obligaciones aplicables. Aplicamos medidas
        técnicas y organizativas razonables para limitar el acceso, proteger las
        credenciales y reducir el riesgo de pérdida, uso indebido o acceso no
        autorizado. Ningún sistema conectado a internet puede garantizar seguridad
        absoluta.
      </p>
    ),
  },
  {
    id: "derechos",
    title: "7. Tus derechos",
    content: (
      <p>
        Podés solicitar información, acceso, corrección o eliminación de tus datos,
        así como oponerte a su tratamiento cuando corresponda. Para proteger tu
        cuenta, podemos pedirte información razonable para verificar tu identidad.
      </p>
    ),
  },
  {
    id: "eliminacion-de-datos",
    title: "8. Eliminación de datos",
    content: (
      <>
        <p>
          Para solicitar la eliminación de datos asociados a Instagram, enviá un
          mensaje directo a la cuenta oficial de SmartBrew con el texto
          <strong> “ELIMINAR DATOS”</strong> e indicá el nombre de usuario afectado.
          Confirmaremos la recepción y, una vez validada la identidad, eliminaremos
          los datos que deban suprimirse de nuestros sistemas activos.
        </p>
        <p>
          También podés retirar desde Instagram el acceso concedido a aplicaciones
          y sitios web. La revocación detiene el acceso futuro, pero no sustituye una
          solicitud de eliminación de información previamente almacenada.
        </p>
      </>
    ),
  },
  {
    id: "menores",
    title: "9. Menores de edad",
    content: (
      <p>
        El servicio no está dirigido intencionalmente a menores de 13 años. Si
        advertimos que recibimos datos de un menor sin autorización válida,
        adoptaremos medidas razonables para eliminarlos.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "10. Cambios y contacto",
    content: (
      <p>
        Podemos actualizar esta política para reflejar cambios legales, técnicos o
        funcionales. Publicaremos aquí la versión vigente y su fecha de
        actualización. Para consultas de privacidad, escribinos por mensaje directo
        a la cuenta oficial de SmartBrew en Instagram.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link href="/" className="brand" aria-label="Volver a SmartBrew">
          <Image
            src="/smartbrew-logo.png"
            alt=""
            width={44}
            height={44}
            className="brand-mark"
            priority
          />
          <span className="brand-name">
            <strong>Smart</strong>Brew
          </span>
        </Link>
        <Link href="/" className="legal-back-link">
          <ArrowLeft aria-hidden="true" size={16} /> Volver al inicio
        </Link>
      </header>

      <main className="legal-main">
        <div className="legal-hero">
          <span className="section-kicker">
            <ShieldCheck aria-hidden="true" size={16} /> Privacidad y datos
          </span>
          <h1>Política de privacidad</h1>
          <p className="legal-intro">
            Esta política explica cómo SmartBrew recopila, utiliza, comparte y
            protege información cuando usás nuestro sitio o interactuás con nuestras
            funciones conectadas a Instagram.
          </p>
          <p className="legal-updated">Última actualización: 9 de septiembre de 2026</p>
        </div>

        <div className="legal-layout">
          <aside className="legal-index" aria-label="Contenido de la política">
            <span>Contenido</span>
            <nav>
              {sections.map((section) => (
                <a href={`#${section.id}`} key={section.id}>
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="legal-content">
            <section className="legal-summary">
              <h2>Responsable</h2>
              <p>
                SmartBrew es el responsable del tratamiento descrito en esta
                política. El servicio se opera desde Argentina y ofrece selección
                de productos, contenidos y respuestas automatizadas relacionadas
                con tecnología, gadgets y café.
              </p>
            </section>

            {sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.content}
              </section>
            ))}
          </article>
        </div>
      </main>

      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} SmartBrew</span>
        <Link href="/productos">Ver productos</Link>
      </footer>
    </div>
  );
}
