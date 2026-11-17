import Link from 'next/link';
import { portalDb, requireAdmin } from '@/lib/portal';
import { ElitApiConnector, ElitApiProductSchema, ElitSearchFieldSchema } from '@/lib/suppliers/elit-api';
import { supplierConnectorConfig } from '@/lib/suppliers/sync';
import SupplierPricingCalculatorForm from '../import/SupplierPricingCalculatorForm';
import { importElitSearchProductAction } from './actions';

export const dynamic = 'force-dynamic';

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
const fieldLabels = {
  nombre: 'Nombre',
  codigo_producto: 'Código de producto',
  codigo_alfa: 'Código alfa',
  id: 'ID de Elit',
} as const;

export default async function ElitSearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string; by?: string; id?: string; offset?: string; error?: string }>;
}) {
  await requireAdmin('/admin/suppliers/elit-search');
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';
  const parsedField = ElitSearchFieldSchema.safeParse(params.by);
  const field = parsedField.success ? parsedField.data : 'nombre';
  const selectedId = typeof params.id === 'string' && /^\d{1,12}$/.test(params.id) ? params.id : '';
  const offsetValue = Number(params.offset || 0);
  const offset = Number.isSafeInteger(offsetValue) && offsetValue >= 0 && offsetValue <= 10_000 ? offsetValue : 0;
  const supplier = await portalDb.supplier.findUnique({ where: { slug: 'elit' } });
  const configured = Boolean(supplier?.usernameEncrypted && supplier.apiKeyEncrypted);
  let result: Awaited<ReturnType<ElitApiConnector['searchProducts']>> | null = null;
  let selected: Awaited<ReturnType<ElitApiConnector['getProduct']>> = null;
  let lookupError = '';

  if (configured && supplier) {
    try {
      const connector = new ElitApiConnector(supplierConnectorConfig(supplier));
      if (query.length >= 2 && query.length <= 80 && (field !== 'id' || /^\d{1,12}$/.test(query))) {
        result = await connector.searchProducts(field, query, offset);
      } else if (query) {
        lookupError = 'Ingresá entre 2 y 80 caracteres. El ID debe contener solo números.';
      }
      if (selectedId) selected = await connector.getProduct(selectedId);
    } catch {
      lookupError = 'No se pudo consultar Elit. Revisá la configuración de la API e intentá nuevamente.';
    }
  }

  const searchUrl = (nextOffset: number) => `/admin/suppliers/elit-search?${new URLSearchParams({ q: query, by: field, offset: String(nextOffset) })}`;
  const selectedRaw = selected ? ElitApiProductSchema.parse(selected.rawData) : null;
  const save = selected ? importElitSearchProductAction.bind(null, selected.externalId) : null;

  return <main className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-yellow-600">Dropshipping · Elit</p>
      <h1 className="text-2xl font-bold">Buscar y cotizar productos</h1>
      <p className="mt-1 text-sm text-gray-500">Consultá Elit por nombre o código. Elegí un producto para calcular el precio de publicación con el módulo existente.</p>
    </header>

    {!configured && <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      Para buscar productos configurá el proveedor con slug <strong>elit</strong>, tipo <strong>elit-v1</strong>, integración <strong>API</strong> y URL <strong>https://clientes.elit.com.ar/v1/api</strong>. Guardá el <strong>user_id</strong> de Elit en “Usuario” y el <strong>token</strong> en “API key”.
      <Link href={supplier ? `/admin/suppliers/${supplier.id}` : '/admin/suppliers/new'} className="ml-2 font-semibold underline">Configurar Elit</Link>
    </section>}

    <form method="get" className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
      <label className="text-sm font-medium">Buscar producto
        <input name="q" defaultValue={query} maxLength={80} placeholder="Ej.: HP 711 o CZ129A" className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950" />
      </label>
      <label className="text-sm font-medium">Buscar por
        <select name="by" defaultValue={field} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950">
          {Object.entries(fieldLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button disabled={!configured} className="self-end rounded-md bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50">Buscar</button>
    </form>

    {lookupError && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{lookupError}</p>}
    {params.error === 'pricing' && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Revisá los valores de la cotización.</p>}
    {params.error === 'product' && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Elit ya no devuelve ese producto. Buscalo nuevamente.</p>}

    {result && <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 text-sm dark:border-gray-800">
        <h2 className="font-semibold">Resultados de Elit ({result.total})</h2>
        <span className="text-gray-500">Mostrando {result.products.length ? offset + 1 : 0}–{offset + result.products.length}</span>
      </div>
      {result.products.length ? <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {result.products.map((product) => <li key={product.externalId} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="font-semibold">{product.title}</p><p className="text-xs text-gray-500">{product.brand || 'Sin marca'} · SKU {product.sku || '—'} · ID {product.externalId} · Stock {product.stock ?? 'sin informar'}</p></div>
          <div className="flex items-center gap-4"><span className="font-semibold">{product.cost == null ? 'Sin costo' : money(product.cost)}</span><Link href={`/admin/suppliers/elit-search?${new URLSearchParams({ q: query, by: field, id: product.externalId })}#cotizacion`} className="rounded border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Cotizar</Link></div>
        </li>)}
      </ul> : <p className="p-6 text-sm text-gray-500">No se encontraron productos para esta búsqueda.</p>}
      {(offset > 0 || offset + result.products.length < result.total) && <nav className="flex justify-between border-t border-gray-200 p-4 text-sm dark:border-gray-800">
        {offset > 0 ? <Link href={searchUrl(Math.max(0, offset - 20))} className="font-semibold text-blue-600">← Anteriores</Link> : <span />}
        {offset + result.products.length < result.total && <Link href={searchUrl(offset + 20)} className="font-semibold text-blue-600">Siguientes →</Link>}
      </nav>}
    </section>}

    {selected && selectedRaw && save && <section className="space-y-5" id="cotizacion">
      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-xl font-bold">{selected.title}</h2>
        <p className="mt-1 text-sm text-gray-500">SKU {selected.sku || '—'} · ID {selected.externalId} · Stock {selected.stock ?? 'sin informar'} · Costo actual {selected.cost == null ? 'sin informar' : money(selected.cost)}</p>
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">La comisión inicial del 13% y el envío en cero son valores de referencia. Ajustalos según tu publicación de Mercado Libre antes de guardar.</p>
        {typeof selected.attributes?.sourceUrl === 'string' && <a href={selected.attributes.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-600 underline">Ver en Elit</a>}
      </div>
      <SupplierPricingCalculatorForm key={selected.externalId} action={save} supplierLabel="Elit" submitLabel="Guardar en oportunidades" initial={{
        supplierPriceUsd: selectedRaw.moneda === 2 ? selectedRaw.precio : 0,
        supplierPriceArs: selectedRaw.moneda === 1 ? selectedRaw.precio : 0,
        supplierCurrency: selectedRaw.moneda === 2 ? 'USD' : 'ARS',
        exchangeRateArsPerUsd: selectedRaw.cotizacion,
        vatTreatment: 'EXCLUDED',
        vatPercentage: selectedRaw.iva,
        internalTaxAmountUsd: selectedRaw.moneda === 2 ? selectedRaw.impuesto_interno : 0,
        internalTaxAmountArs: selectedRaw.moneda === 1 ? selectedRaw.impuesto_interno : 0,
        supplierPvpUsd: selectedRaw.pvp_usd ?? 0,
        supplierPvpArs: selectedRaw.pvp_ars ?? 0,
        supplierMarkupPercentage: selectedRaw.markup ?? 0,
        productSearchCostArs: 0,
        shippingCostArs: 0,
        marketplaceFeePercentage: 13,
        marketplaceFixedFeeArs: 0,
        marketplaceCategoryId: '',
        marketplaceListingTypeId: 'gold_special',
        targetMarginPercentage: 20,
      }} />
    </section>}
  </main>;
}
