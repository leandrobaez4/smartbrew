import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildManualMercadoLibrePublication } from '@/lib/manual-mercado-libre-publication';
import { portalDb, requireAdmin } from '@/lib/portal';
import { supplierPackageDefaults } from '@/lib/supplier-package';
import ManualPublicationActions from './ManualPublicationActions';

export const dynamic = 'force-dynamic';

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

export default async function ManualPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const product = await portalDb.supplierProduct.findUnique({
    where: { id },
    include: { supplier: true, pricing: true },
  });
  if (!product || product.supplier.slug !== 'unidrop') notFound();
  const opportunityHref = `/admin/opportunities/${product.id}`;

  if (product.editorialStatus !== 'APPROVED') return <main className="mx-auto max-w-3xl space-y-5">
    <Link href={opportunityHref} className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Volver a la oportunidad</Link>
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <h1 className="text-xl font-bold">Revisá el contenido antes de preparar la publicación</h1>
      <p className="mt-2 text-sm">El título y la descripción requieren aprobación explícita. Tu configuración de costos y paquete ya está guardada.</p>
      <Link href={`${opportunityHref}#contenido-publicar`} className="mt-4 inline-block rounded bg-emerald-600 px-4 py-2 font-semibold text-white">Revisar y aprobar contenido</Link>
    </section>
  </main>;

  let publication;
  try {
    publication = buildManualMercadoLibrePublication({
      ...product,
      pricing: product.pricing ? {
        finalPriceArs: Number(product.pricing.finalPriceArs),
        marketplaceCategoryId: product.pricing.marketplaceCategoryId,
      } : null,
      package: supplierPackageDefaults(product),
    });
  } catch (error) {
    return <main className="mx-auto max-w-3xl space-y-5">
      <Link href={opportunityHref} className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Volver a la oportunidad</Link>
      <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-bold">Faltan datos para la publicación manual</h1>
        <p className="mt-2 text-sm">{error instanceof Error ? error.message : 'Revisá el precio, el SKU y las medidas del paquete.'}</p>
      </section>
    </main>;
  }

  return <main className="mx-auto max-w-5xl space-y-6">
    <div><Link href={opportunityHref} className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Volver a la oportunidad</Link><p className="mt-3 text-sm font-semibold text-yellow-600">Unidrop · Publicación manual</p><h1 className="text-2xl font-bold">Paquete para Mercado Libre</h1><p className="mt-1 text-sm text-gray-500">SmartBrew no publicará automáticamente. Copiá los datos y cargalos en Mercado Libre.</p></div>
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <ManualPublicationActions publication={publication} />
      <Link href={`/admin/opportunities/${product.id}/link-listing`} className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">Ya la publiqué: vincular por SELLER_SKU →</Link>
    </section>
    <section className="grid gap-4 md:grid-cols-2">
      <Card title="Contenido revisado"><Field label="Título" value={publication.title} /><Field label="Descripción" value={publication.description} multiline /></Card>
      <Card title="Datos de venta"><Field label="SELLER_SKU obligatorio" value={publication.sellerSku} strong /><Field label="Categoría sugerida" value={publication.categoryId || 'Sin configurar'} /><Field label="Precio" value={money(publication.priceArs)} /><Field label="Stock" value={String(publication.availableQuantity)} /></Card>
      <Card title="Paquete"><Field label="Peso" value={`${publication.package.weightGrams} g`} /><Field label="Medidas" value={`${publication.package.heightCm} × ${publication.package.widthCm} × ${publication.package.lengthCm} cm`} /></Card>
      <Card title="Imágenes y atributos"><Field label="Imágenes" value={publication.pictures.map((picture) => picture.source).join('\n')} multiline /><Field label="Atributos sugeridos" value={publication.attributes.map((attribute) => `${attribute.id}: ${attribute.value_name}`).join('\n')} multiline /></Card>
    </section>
  </main>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h2 className="font-bold">{title}</h2><dl className="mt-3 space-y-3 text-sm">{children}</dl></section>;
}

function Field({ label, value, multiline = false, strong = false }: { label: string; value: string; multiline?: boolean; strong?: boolean }) {
  return <div><dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt><dd className={`${multiline ? 'whitespace-pre-wrap break-all' : ''} ${strong ? 'text-lg font-bold text-blue-700 dark:text-blue-300' : 'font-medium'}`}>{value || '—'}</dd></div>;
}
