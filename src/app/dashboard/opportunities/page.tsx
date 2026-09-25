import Link from 'next/link';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateOpportunities, OpportunityConfig, OpportunityFilters } from '@/lib/opportunities';
import PublishOpportunityButton from './PublishOpportunityButton';

export const dynamic = 'force-dynamic';

function numberParam(value: string | undefined) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function configuredNumber(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function money(value: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
}

export default async function OpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const value = (name: string) => typeof params[name] === 'string' ? params[name] : undefined;
  const sortValue = value('sort');
  const filters: OpportunityFilters = {
    supplierId: value('supplier'),
    category: value('category'),
    minimumMargin: numberParam(value('minimumMargin')),
    maximumCost: numberParam(value('maximumCost')),
    minimumStock: numberParam(value('minimumStock')),
    sort: ['score', 'margin', 'roi', 'profit', 'cost'].includes(sortValue || '') ? sortValue as OpportunityFilters['sort'] : 'score',
  };
  const config: OpportunityConfig = {
    marketplaceFee: configuredNumber('MARKETPLACE_FEE', 0),
    shippingCost: configuredNumber('MARKETPLACE_SHIPPING_COST', 0),
    taxes: configuredNumber('MARKETPLACE_TAXES', 0),
    extraCosts: configuredNumber('MARKETPLACE_EXTRA_COSTS', 0),
    targetMarginPercentage: configuredNumber('TARGET_PROFIT_PERCENTAGE', 20),
    minimumMarginPercentage: configuredNumber('MINIMUM_PROFIT_PERCENTAGE', 20),
    minimumProfitAmount: configuredNumber('MINIMUM_PROFIT_AMOUNT', 0),
  };
  const products = await portalDb.supplierProduct.findMany({
    where: { active: true, stock: { gt: 0 }, cost: { not: null }, supplier: { status: 'ACTIVE' } },
    include: {
      supplier: true,
      listings: { orderBy: { updatedAt: 'desc' }, take: 1 },
      pricing: true,
      history: { orderBy: { createdAt: 'desc' }, take: 12, select: { cost: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { title: 'asc' },
  });
  const calculatedOpportunities = calculateOpportunities(products.map((product) => ({
    ...product,
    cost: product.cost == null ? null : Number(product.cost),
    history: product.history.map((entry) => ({ cost: entry.cost == null ? null : Number(entry.cost) })),
    orderCount: product._count.orders,
    listings: product.listings.map((listing) => ({ status: listing.status })),
  })), config, filters);
  const pricingByProduct = new Map(products.flatMap((product) => product.pricing ? [[product.id, product.pricing] as const] : []));
  const opportunities = calculatedOpportunities.map((row) => {
    const saved = pricingByProduct.get(row.id);
    if (!saved) return row;
    const totalCost = Number(saved.totalCostArs);
    const profit = Number(saved.targetProfitArs);
    return {
      ...row,
      recommendedPrice: Number(saved.finalPriceArs),
      estimatedProfit: profit,
      marginPercentage: Number(saved.targetMarginPercentage),
      roi: totalCost > 0 ? profit / totalCost * 100 : 0,
    };
  });
  const suppliers = [...new Map(products.map((product) => [product.supplier.id, product.supplier])).values()];
  const categories = [...new Set(products.flatMap((product) => product.category ? [product.category] : []))].sort();
  const accountId = process.env.MERCADO_LIBRE_ACCOUNT_ID || '';
  const publicationCosts = {
    marketplaceFee: config.marketplaceFee,
    shippingCost: config.shippingCost,
    taxes: config.taxes,
    extraCosts: config.extraCosts,
    targetMarginPercentage: config.targetMarginPercentage,
  };

  return <main className="min-h-screen bg-gray-100 p-6 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-yellow-600">Dropshipping</p><h1 className="text-3xl font-bold">Oportunidades</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Productos con stock ordenados por rentabilidad estimada.</p></div><Link href="/admin/suppliers" className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Administrar proveedores</Link></div>
      {!accountId && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Configurá MERCADO_LIBRE_ACCOUNT_ID para habilitar la publicación.</div>}
      <form className="mb-5 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-3 xl:grid-cols-6">
        <select name="supplier" defaultValue={filters.supplierId || ''} className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="">Todos los proveedores</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
        <select name="category" defaultValue={filters.category || ''} className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="">Todas las categorías</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <input name="minimumMargin" type="number" min="0" max="99" step="0.01" defaultValue={filters.minimumMargin} placeholder="Margen mínimo %" className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950" />
        <input name="maximumCost" type="number" min="0" step="0.01" defaultValue={filters.maximumCost} placeholder="Costo máximo" className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950" />
        <input name="minimumStock" type="number" min="0" step="1" defaultValue={filters.minimumStock} placeholder="Stock mínimo" className="rounded border p-2 dark:border-gray-700 dark:bg-gray-950" />
        <div className="flex gap-2"><select name="sort" defaultValue={filters.sort} className="min-w-0 flex-1 rounded border p-2 dark:border-gray-700 dark:bg-gray-950"><option value="score">Mayor score</option><option value="margin">Mayor margen</option><option value="roi">Mayor ROI</option><option value="profit">Mayor ganancia</option><option value="cost">Menor costo</option></select><button className="rounded bg-gray-900 px-4 py-2 text-white dark:bg-gray-100 dark:text-gray-950">Aplicar</button></div>
      </form>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow dark:border-gray-800 dark:bg-gray-900"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950"><tr>{['Producto', 'Score', 'Proveedor', 'Costo', 'Stock', 'Precio recomendado', 'Ganancia estimada', 'Margen', 'ROI', 'Estado', 'Acción'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-gray-200 dark:divide-gray-800">{opportunities.map((row) => <tr key={row.id}><td className="px-4 py-3"><Link href={`/dashboard/opportunities/${row.id}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{row.editorialTitle || row.title}</Link><p className="text-xs text-gray-500">{row.category || 'Sin categoría'} · contenido {row.editorialStatus || 'PENDING'}</p></td><td className="px-4 py-3"><p className="text-lg font-bold">{row.productScore}</p><p className="text-[11px] text-gray-500" title={`Factores estimados: ${row.estimatedScoreFactors.join(', ') || 'ninguno'}`}>{row.estimatedScoreFactors.length ? `${row.estimatedScoreFactors.length} factor(es) estimado(s)` : 'Datos reales'}</p></td><td className="px-4 py-3 text-sm">{row.supplier.name}</td><td className="px-4 py-3 text-sm">{money(row.cost, row.currency || 'ARS')}</td><td className="px-4 py-3 text-sm">{row.stock}</td><td className="px-4 py-3 font-semibold">{money(row.recommendedPrice, row.currency || 'ARS')}</td><td className="px-4 py-3 text-sm text-green-700 dark:text-green-400">{money(row.estimatedProfit, row.currency || 'ARS')}</td><td className="px-4 py-3 text-sm">{row.marginPercentage.toFixed(2)}%</td><td className="px-4 py-3 text-sm">{row.roi.toFixed(2)}%</td><td className="px-4 py-3 text-xs font-semibold">{row.listingStatus}</td><td className="px-4 py-3"><PublishOpportunityButton productId={row.id} accountId={accountId} costs={publicationCosts} disabled={!accountId || row.listingStatus === 'ACTIVE' || row.editorialStatus !== 'APPROVED'} /></td></tr>)}{!opportunities.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-500">No hay oportunidades que coincidan con los filtros.</td></tr>}</tbody></table></div>
    </div>
  </main>;
}
