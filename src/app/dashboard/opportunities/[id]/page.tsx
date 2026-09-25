import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import PricingCalculatorForm from '@/app/admin/(dashboard)/suppliers/elit-import/PricingCalculatorForm';
import { approveSupplierEditorialAction, generateSupplierEditorialAction, updateSupplierProductPricingAction } from './actions';

export const dynamic = 'force-dynamic';

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').join('\n') : '';
}

export default async function SupplierProductEditorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; generated?: string; imported?: string; pricingSaved?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await portalDb.supplierProduct.findUnique({ where: { id }, include: { supplier: true, pricing: true } });
  if (!product) notFound();
  const generate = generateSupplierEditorialAction.bind(null, id);
  const approve = approveSupplierEditorialAction.bind(null, id);
  const updatePricing = updateSupplierProductPricingAction.bind(null, id);
  const inputClass = 'mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100';

  return <main className="mx-auto max-w-5xl space-y-6">
    <div>
      <Link href="/dashboard/opportunities" className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Oportunidades</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-yellow-600">{product.supplier.name}</p><h1 className="text-3xl font-bold">Revisión editorial</h1><p className="mt-1 text-sm text-gray-500">Estado: {product.editorialStatus}</p></div>
        <form action={generate}><button className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">Generar con IA</button></form>
      </div>
    </div>

    {query.saved && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Contenido revisado y aprobado para publicar.</p>}
    {query.imported && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Producto de Elit y cálculo inicial guardados.</p>}
    {query.pricingSaved && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Costos, comisión, margen y precio final actualizados.</p>}
    {query.generated && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Contenido generado. Revisalo antes de aprobar.</p>}
    {(query.error || product.editorialError) && <p className="rounded bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">No se pudo procesar el contenido. {product.editorialError || 'Revisá todos los campos.'}</p>}

    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-bold">Datos reales del proveedor</h2>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2"><div><dt className="text-gray-500">Título</dt><dd>{product.title}</dd></div><div><dt className="text-gray-500">Marca / categoría</dt><dd>{product.brand || '—'} · {product.category || '—'}</dd></div><div className="md:col-span-2"><dt className="text-gray-500">Descripción</dt><dd className="whitespace-pre-wrap">{product.description || '—'}</dd></div><div className="md:col-span-2"><dt className="text-gray-500">Atributos</dt><dd className="overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(product.attributes, null, 2)}</dd></div></dl>
    </section>

    {product.pricing && <section className="space-y-4">
      <div><h2 className="text-2xl font-bold">Calculadora de publicación</h2><p className="mt-1 text-sm text-gray-500">Todos los importes pueden revisarse y configurarse desde SmartBrew.</p></div>
      {product.pricing.marketplaceFeeSyncedAt && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Comisión de Mercado Libre consultada el {product.pricing.marketplaceFeeSyncedAt.toLocaleString('es-AR')}.</p>}
      <PricingCalculatorForm action={updatePricing} submitLabel="Guardar cálculo" initial={{
        supplierPriceUsd: Number(product.pricing.supplierPriceUsd),
        exchangeRateArsPerUsd: Number(product.pricing.exchangeRateArsPerUsd),
        vatPercentage: Number(product.pricing.vatPercentage),
        productSearchCostArs: Number(product.pricing.productSearchCostArs),
        shippingCostArs: Number(product.pricing.shippingCostArs),
        marketplaceFeePercentage: Number(product.pricing.marketplaceFeePercentage),
        marketplaceFixedFeeArs: Number(product.pricing.marketplaceFixedFeeArs),
        marketplaceCategoryId: product.pricing.marketplaceCategoryId || '',
        marketplaceListingTypeId: product.pricing.marketplaceListingTypeId as 'gold_special' | 'gold_pro',
        targetMarginPercentage: Number(product.pricing.targetMarginPercentage),
      }} />
    </section>}

    <form action={approve} className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-bold">Contenido a publicar</h2>
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
