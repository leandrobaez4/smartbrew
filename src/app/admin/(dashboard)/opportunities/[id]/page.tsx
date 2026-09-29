import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import { compareSupplierPvp, resolveSupplierPvpArs } from '@/lib/supplier-pvp-comparison';
import SupplierPricingCalculatorForm from '@/app/admin/(dashboard)/suppliers/import/SupplierPricingCalculatorForm';
import { inferVatTreatment } from '@/lib/supplier-product-pricing';
import { supplierPackageDefaults } from '@/lib/supplier-package';
import { approveSupplierEditorialAction, generateSupplierEditorialAction, updateSupplierProductPricingAction } from './actions';

export const dynamic = 'force-dynamic';

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join('\n') : '';
}

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export default async function SupplierProductEditorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; generated?: string; imported?: string; pricingSaved?: string; linked?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await portalDb.supplierProduct.findUnique({ where: { id }, include: { supplier: true, pricing: true, listings: { orderBy: { updatedAt: 'desc' }, take: 1 } } });
  if (!product) notFound();
  const generate = generateSupplierEditorialAction.bind(null, id);
  const approve = approveSupplierEditorialAction.bind(null, id);
  const updatePricing = updateSupplierProductPricingAction.bind(null, id);
  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';
  const supplierPvpArs = product.pricing ? resolveSupplierPvpArs({
    supplierPvpArs: Number(product.pricing.supplierPvpArs || 0),
    supplierPvpUsd: Number(product.pricing.supplierPvpUsd || 0),
    exchangeRateArsPerUsd: Number(product.pricing.exchangeRateArsPerUsd),
  }) : null;
  const listing = product.listings[0];
  const pvpComparison = compareSupplierPvp(supplierPvpArs, listing?.price == null ? null : Number(listing.price));

  return <main className="mx-auto max-w-5xl space-y-6">
    <div>
      <Link href="/admin/opportunities" className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Oportunidades</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-yellow-600">{product.supplier.name}</p><h1 className="text-2xl font-bold">Revisión editorial</h1><p className="mt-1 text-sm text-gray-500">Estado: {product.editorialStatus}</p></div>
        <div className="flex flex-wrap gap-2">{product.supplier.slug === 'unidrop' && <Link href={`/admin/opportunities/${product.id}/manual-publication`} className="rounded bg-yellow-500 px-4 py-2 font-semibold text-gray-950 hover:bg-yellow-400">Preparar publicación manual</Link>}<form action={generate}><button className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">{product.supplier.integrationType === 'API' ? `Actualizar desde ${product.supplier.name} y generar con IA` : `Generar con IA desde datos de ${product.supplier.name}`}</button></form></div>
      </div>
    </div>

    {query.saved && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Contenido revisado y aprobado para publicar.</p>}
    {query.imported && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Producto de Elit y cálculo inicial guardados.</p>}
    {query.pricingSaved && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Costos, comisión, margen y precio final actualizados.</p>}
    {query.linked && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Publicación de Mercado Libre vinculada y sincronizada.</p>}
    {query.generated && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Contenido generado. Revisalo antes de aprobar.</p>}
    {(query.error || product.editorialError) && <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">No se pudo procesar el contenido. {product.editorialError || 'Revisá todos los campos.'}</p>}
    {product.editorialStatus !== 'APPROVED' && <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><p>Antes de publicar en Mercado Libre, revisá el título, la descripción y los datos generados.</p><a href="#contenido-publicar" className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-500">Ir a revisar y aprobar</a></div>}

    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-bold">Datos reales del proveedor</h2>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Título</dt><dd>{product.title}</dd></div><div><dt className="text-gray-500">Marca / categoría</dt><dd>{product.brand || '—'} · {product.category || '—'}</dd></div><div><dt className="text-gray-500">Identificadores</dt><dd>ID {product.externalId} · SKU {product.sku || '—'} · EAN {product.ean || '—'}</dd></div><div><dt className="text-gray-500">Fuente editorial</dt><dd>{product.supplier.integrationType === 'API' ? `API de ${product.supplier.name}` : `Snapshot importado de ${product.supplier.name}`} · actualizado {product.lastSyncAt.toLocaleString('es-AR')}</dd></div><div className="md:col-span-2"><dt className="text-gray-500">Descripción</dt><dd className="whitespace-pre-wrap">{product.description || '—'}</dd></div><div className="md:col-span-2"><dt className="text-gray-500">Atributos</dt><dd className="overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(product.attributes, null, 2)}</dd></div></dl>
    </section>

    {product.supplier.slug === 'unidrop' && <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Vínculo con Mercado Libre</h2>{listing?.marketplaceItemId ? <p className="mt-1 text-sm">SKU <strong>{product.sku || '—'}</strong> · MLA <a href={`https://articulo.mercadolibre.com.ar/${listing.marketplaceItemId}`} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{listing.marketplaceItemId}</a> · {listing.status}</p> : <p className="mt-1 text-sm text-gray-500">SKU {product.sku || '—'} todavía sin publicación asociada.</p>}</div><Link href={`/admin/opportunities/${product.id}/link-listing`} className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500">{listing?.marketplaceItemId ? 'Revalidar vínculo' : 'Vincular por SELLER_SKU'}</Link></div>
    </section>}

    {product.pricing && <section className="space-y-4">
      <div><h2 className="text-2xl font-bold">Calculadora de publicación</h2><p className="mt-1 text-sm text-gray-500">Todos los importes pueden revisarse y configurarse desde SmartBrew.</p></div>
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="font-bold">PVP del proveedor vs. nuestra publicación</h3>
        {pvpComparison ? <dl className="mt-3 grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-gray-500">PVP proveedor</dt><dd className="font-semibold">{money(pvpComparison.supplierPvpArs)}</dd></div>
          <div><dt className="text-gray-500">Precio publicado</dt><dd className="font-semibold">{money(pvpComparison.publishedPriceArs)}</dd></div>
          <div><dt className="text-gray-500">Diferencia</dt><dd className="font-semibold">{money(pvpComparison.differenceArs)} ({pvpComparison.differencePercentage.toFixed(2)}%)</dd></div>
          <div><dt className="text-gray-500">Posición</dt><dd className={pvpComparison.position === 'BELOW' ? 'font-semibold text-red-700 dark:text-red-400' : pvpComparison.position === 'ABOVE' ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'font-semibold'}>{pvpComparison.position === 'BELOW' ? 'Debajo del PVP' : pvpComparison.position === 'ABOVE' ? 'Encima del PVP' : 'Igual al PVP'}</dd></div>
        </dl> : <p className="mt-2 text-sm text-gray-500">La comparación estará disponible cuando el proveedor informe PVP y exista una publicación con precio sincronizado.</p>}
      </div>
      {product.pricing.marketplaceFeeSyncedAt && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Comisión de Mercado Libre consultada el {product.pricing.marketplaceFeeSyncedAt.toLocaleString('es-AR')}.</p>}
      <SupplierPricingCalculatorForm action={updatePricing} submitLabel="Guardar cálculo" supplierLabel={product.supplier.name} packageDefaults={supplierPackageDefaults(product)} initial={{
        supplierPriceUsd: Number(product.pricing.supplierPriceUsd),
        supplierPriceArs: Number(product.pricing.supplierPriceArs),
        supplierCurrency: product.pricing.supplierCurrency === 'ARS' ? 'ARS' : 'USD',
        exchangeRateArsPerUsd: Number(product.pricing.exchangeRateArsPerUsd),
        vatTreatment: inferVatTreatment({
          supplierCurrency: product.pricing.supplierCurrency,
          supplierPriceArs: Number(product.pricing.supplierPriceArs),
          supplierCostWithVatArs: Number(product.pricing.supplierCostWithVatArs),
          vatPercentage: Number(product.pricing.vatPercentage),
        }),
        vatPercentage: Number(product.pricing.vatPercentage),
        internalTaxAmountUsd: Number(product.pricing.internalTaxAmountUsd),
        internalTaxAmountArs: Number(product.pricing.internalTaxAmountArs),
        supplierPvpUsd: Number(product.pricing.supplierPvpUsd || 0),
        supplierPvpArs: Number(product.pricing.supplierPvpArs || 0),
        supplierMarkupPercentage: Number(product.pricing.supplierMarkupPercentage || 0),
        productSearchCostArs: Number(product.pricing.productSearchCostArs),
        shippingCostArs: Number(product.pricing.shippingCostArs),
        marketplaceFeePercentage: Number(product.pricing.marketplaceFeePercentage),
        marketplaceFixedFeeArs: Number(product.pricing.marketplaceFixedFeeArs),
        marketplaceCategoryId: product.pricing.marketplaceCategoryId || '',
        marketplaceListingTypeId: product.pricing.marketplaceListingTypeId as 'gold_special' | 'gold_pro',
        targetMarginPercentage: Number(product.pricing.targetMarginPercentage),
      }} />
    </section>}

    <form id="contenido-publicar" action={approve} className="scroll-mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div><h2 className="font-bold">Contenido a publicar</h2><p className="mt-1 text-sm text-gray-500">Revisá estos campos y presioná “Guardar y aprobar contenido”. Después vas a poder publicar desde Oportunidades.</p></div>
      <label className="block text-sm font-medium">Título<input name="title" className={inputClass} defaultValue={product.editorialTitle || ''} minLength={3} maxLength={120} required /></label>
      <label className="block text-sm font-medium">Descripción<textarea name="description" className={inputClass} rows={8} defaultValue={product.editorialDescription || ''} minLength={40} maxLength={2000} required /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">Bullet points, uno por línea<textarea name="bulletPoints" className={inputClass} rows={7} defaultValue={textList(product.editorialBulletPoints)} required /></label>
        <label className="block text-sm font-medium">Destacados, uno por línea<textarea name="productHighlights" className={inputClass} rows={7} defaultValue={textList(product.editorialHighlights)} required /></label>
      </div>
      <label className="block text-sm font-medium">Palabras SEO, una por línea<textarea name="seoKeywords" className={inputClass} rows={5} defaultValue={product.editorialSeoKeywords.join('\n')} required /></label>
      <button className="rounded bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500">Guardar y aprobar contenido</button>
    </form>
  </main>;
}
