import Link from 'next/link';
import { getDropshippingDashboard, parseDashboardPeriod } from '@/lib/dropshipping-dashboard';
import { requireAdmin } from '@/lib/portal';

export const dynamic = 'force-dynamic';

function number(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export default async function DropshippingDashboardPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = parseDashboardPeriod(typeof params.period === 'string' ? params.period : undefined);
  const metrics = await getDropshippingDashboard(period);
  const cards = [
    ['Productos activos', number(metrics.activeProducts), '/dashboard/opportunities'],
    ['Proveedores activos', number(metrics.activeSuppliers), '/admin/suppliers'],
    ['Publicaciones activas', number(metrics.marketplaceListings), '/dashboard/opportunities'],
    ['Órdenes de hoy', number(metrics.ordersToday), '/admin/orders'],
    ['Revenue', money(metrics.revenue), `/dashboard/dropshipping/profitability?period=${period}`],
    ['Ganancia estimada', money(metrics.estimatedProfit), `/dashboard/dropshipping/profitability?period=${period}`],
    ['Margen promedio', `${number(metrics.averageMargin)}%`, `/dashboard/dropshipping/profitability?period=${period}`],
    ['Productos pausados', number(metrics.productsPaused), '/dashboard/opportunities?status=PAUSED'],
    ['Productos sin stock', number(metrics.productsWithoutStock), '/dashboard/opportunities?minimumStock=0'],
    ['Errores de proveedor', number(metrics.supplierErrors), `/admin/logs?status=ERROR&period=${period}`],
  ] as const;

  return <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-yellow-600">Dropshipping</p>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Estado operativo y resultados desde {metrics.from.toLocaleDateString('es-AR')}.</p>
        </div>
        <form className="flex items-center gap-2">
          <label htmlFor="period" className="text-sm font-medium">Período</label>
          <select id="period" name="period" defaultValue={period} className="rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
            <option value="1">24 horas</option>
            <option value="7">7 días</option>
            <option value="30">30 días</option>
            <option value="90">90 días</option>
          </select>
          <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-950">Aplicar</button>
        </form>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Métricas de Dropshipping">
        {cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400">Ver detalle →</p>
        </Link>)}
      </section>
  </div>;
}
