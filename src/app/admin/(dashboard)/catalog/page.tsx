import type { Prisma } from '@prisma/client';
import Link from 'next/link';
import { affiliateCatalogItem, mergeCatalogItems, supplierCatalogItem } from '@/lib/catalog-read-model';
import { portalDb, requireAdmin } from '@/lib/portal';

export const dynamic = 'force-dynamic';

const pageSize = 25;

function value(params: Record<string, string | string[] | undefined>, name: string) {
  return typeof params[name] === 'string' ? params[name] : '';
}

function money(amount: number | null, currency: string | null) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency || 'ARS' }).format(amount);
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return `?${next}`;
}

export default async function CatalogPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin('/admin/catalog');
  const params = await searchParams;
  const search = value(params, 'search').trim();
  const source = value(params, 'source');
  const supplierId = value(params, 'supplier');
  const availability = value(params, 'availability');
  const requestedPage = Number(value(params, 'page') || '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const affiliateWhere: Prisma.ProductWhereInput = search ? {
    OR: [{ title: { contains: search, mode: 'insensitive' } }, { externalId: { contains: search, mode: 'insensitive' } }],
  } : {};
  const supplierWhere: Prisma.SupplierProductWhereInput = {
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { externalId: { contains: search, mode: 'insensitive' as const } }, { sku: { contains: search, mode: 'insensitive' as const } }] } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(availability === 'AVAILABLE' ? { stock: { gt: 0 } } : availability === 'UNAVAILABLE' ? { stock: 0 } : {}),
  };
  const [affiliates, supplierProducts, suppliers] = await Promise.all([
    source !== 'SUPPLIER' && !availability && !supplierId ? portalDb.product.findMany({ where: affiliateWhere, orderBy: { updatedAt: 'desc' }, take: 500 }) : [],
    source !== 'AFFILIATE_MARKETPLACE' ? portalDb.supplierProduct.findMany({
      where: supplierWhere,
      include: { supplier: true, pricing: true, listings: { orderBy: { updatedAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    }) : [],
    portalDb.supplier.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const items = mergeCatalogItems(
    affiliates.map((product) => affiliateCatalogItem({
      id: product.id,
      title: product.displayTitle || product.title,
      externalId: product.externalId,
      marketplace: product.marketplace,
      status: product.status,
      price: product.price == null ? null : Number(product.price),
      currency: product.currencyId,
      imageUrl: product.primaryImageUrl,
      affiliateUrl: product.affiliateUrl,
      updatedAt: product.updatedAt,
    })),
    supplierProducts.map((product) => supplierCatalogItem({
      id: product.id,
      title: product.editorialTitle || product.title,
      externalId: product.externalId,
      sku: product.sku,
      active: product.active,
      stock: product.stock,
      imageUrl: product.images[0] || null,
      publishedPrice: product.listings[0]?.price == null ? null : Number(product.listings[0].price),
      calculatedPrice: product.pricing?.finalPriceArs == null ? null : Number(product.pricing.finalPriceArs),
      currency: 'ARS',
      updatedAt: product.updatedAt,
      lastSyncAt: product.lastSyncAt,
      listingStatus: product.listings[0]?.status || null,
      supplier: product.supplier,
    })),
  );
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const currentParams = new URLSearchParams();
  if (search) currentParams.set('search', search);
  if (source) currentParams.set('source', source);
  if (supplierId) currentParams.set('supplier', supplierId);
  if (availability) currentParams.set('availability', availability);

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <div><p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Lectura unificada</p><h1 className="text-2xl font-bold">Catálogo</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Afiliados y ofertas de proveedores se muestran juntos, pero conservan su identidad, flujo y acciones independientes.</p></div>
    <form className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2 xl:grid-cols-5">
      <input name="search" defaultValue={search} placeholder="Título, ID o SKU" className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950" />
      <select name="source" defaultValue={source} className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="">Todos los orígenes</option><option value="AFFILIATE_MARKETPLACE">Afiliados Mercado Libre</option><option value="SUPPLIER">Dropshipping</option></select>
      <select name="supplier" defaultValue={supplierId} className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="">Todos los proveedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
      <select name="availability" defaultValue={availability} className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="">Toda disponibilidad</option><option value="AVAILABLE">Con stock</option><option value="UNAVAILABLE">Sin stock</option></select>
      <button className="rounded bg-gray-900 px-4 py-2 font-semibold text-white dark:bg-gray-100 dark:text-gray-950">Aplicar filtros</button>
    </form>
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950"><tr>{['Producto', 'Origen', 'Identidad', 'Estado', 'Disponibilidad', 'Precio', 'Actualizado', 'Acción'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">{visibleItems.map((item) => <tr key={item.catalogKey}>
          <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">{item.title.charAt(0).toUpperCase()}</div><div><p className="max-w-sm font-semibold">{item.title}</p><p className="text-xs text-gray-500">{item.externalId || 'Sin ID externo'}</p></div></div></td>
          <td className="px-4 py-3">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">Afiliado · {item.marketplace}</span> : <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">Dropshipping · {item.supplierName}</span>}</td>
          <td className="px-4 py-3 text-sm">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? <><p>Producto {item.productId}</p><p className="text-xs text-gray-500">Compra externa por enlace de afiliado</p></> : <><p>{item.supplierSlug} · {item.sku || item.externalId}</p><p className="text-xs text-gray-500">Oferta propia del proveedor</p></>}</td>
          <td className="px-4 py-3 text-sm font-semibold">{item.status}{item.sourceKind === 'SUPPLIER' && item.listingStatus ? <p className="text-xs font-normal text-gray-500">ML: {item.listingStatus}</p> : null}</td>
          <td className="px-4 py-3 text-sm">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? 'No aplica' : item.availability === 'UNKNOWN' ? 'Sin informar' : item.availability === 'AVAILABLE' ? `${item.stock} en stock` : 'Sin stock'}</td>
          <td className="px-4 py-3 text-sm"><p className="font-semibold">{money(item.price, item.currency)}</p>{item.sourceKind === 'SUPPLIER' && item.priceKind ? <p className="text-xs text-gray-500">{item.priceKind === 'PUBLISHED' ? 'Publicado en ML' : 'Calculado por SmartBrew'}</p> : null}</td>
          <td className="px-4 py-3 text-sm"><time dateTime={item.updatedAt.toISOString()}>{item.updatedAt.toLocaleString('es-AR')}</time>{item.sourceKind === 'SUPPLIER' ? <p className="text-xs text-gray-500">Sync {item.lastSyncAt.toLocaleString('es-AR')}</p> : null}</td>
          <td className="px-4 py-3"><Link href={item.href} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{item.sourceKind === 'AFFILIATE_MARKETPLACE' ? 'Ver afiliado' : 'Ver dropshipping'}</Link></td>
        </tr>)}{!visibleItems.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No hay productos para estos filtros.</td></tr>}</tbody>
      </table>
    </div>
    {totalPages > 1 && <nav aria-label="Paginación" className="flex items-center justify-between text-sm"><p>{items.length} productos · página {currentPage} de {totalPages}</p><div className="flex gap-2">{currentPage > 1 && <Link href={pageHref(currentParams, currentPage - 1)} className="rounded border px-3 py-2 dark:border-gray-700">Anterior</Link>}{currentPage < totalPages && <Link href={pageHref(currentParams, currentPage + 1)} className="rounded border px-3 py-2 dark:border-gray-700">Siguiente</Link>}</div></nav>}
  </div>;
}
