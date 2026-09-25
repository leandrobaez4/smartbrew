import Link from 'next/link';
import { parseDashboardPeriod } from '@/lib/dropshipping-dashboard';
import { getProfitability, parseProfitabilityGroup, profitabilityGroups } from '@/lib/dropshipping-profitability';
import { requireAdmin } from '@/lib/portal';

export const dynamic = 'force-dynamic';

const groupLabels = {
  product: 'Producto', supplier: 'Proveedor', category: 'Categoría',
  day: 'Día', week: 'Semana', month: 'Mes',
} as const;

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function percent(value: number) {
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)}%`;
}

export default async function ProfitabilityPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = parseDashboardPeriod(typeof params.period === 'string' ? params.period : undefined);
  const group = parseProfitabilityGroup(typeof params.group === 'string' ? params.group : undefined);
  const report = await getProfitability(period, group);
  const summary = [
    ['Revenue', money(report.totals.revenue)],
    ['Costo proveedor', money(report.totals.supplierCost)],
    ['Fees marketplace', money(report.totals.marketplaceFees)],
    ['Envío', money(report.totals.shipping)],
    ['Impuestos', money(report.totals.taxes)],
    ['Ganancia neta', money(report.totals.netProfit)],
    ['Margen', percent(report.totals.margin)],
    ['ROI', percent(report.totals.roi)],
  ];

  return <main className="min-h-screen bg-gray-100 p-6 text-gray-950 dark:bg-gray-950 dark:text-gray-100">
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/dashboard/dropshipping?period=${period}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold">Rentabilidad</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Snapshots financieros de órdenes desde {report.from.toLocaleDateString('es-AR')}.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm font-medium">Período
            <select name="period" defaultValue={period} className="rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <option value="1">24 horas</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">Agrupar por
            <select name="group" defaultValue={group} className="rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              {profitabilityGroups.map((value) => <option key={value} value={value}>{groupLabels[value]}</option>)}
            </select>
          </label>
          <button className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-950">Aplicar</button>
        </form>
      </div>

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Revenue y costo del proveedor son snapshots capturados al crear cada orden. Fees, envío e impuestos se muestran como estimados hasta su conciliación; cada fila indica su estado.
      </div>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de rentabilidad">
        {summary.map(([label, value]) => <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 text-xl font-bold">{value}</p>
        </div>)}
      </section>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left dark:bg-gray-900"><tr>
            <th className="px-4 py-3">{groupLabels[group]}</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Órdenes</th>
            <th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Costo</th><th className="px-4 py-3 text-right">Fees</th>
            <th className="px-4 py-3 text-right">Envío</th><th className="px-4 py-3 text-right">Impuestos</th><th className="px-4 py-3 text-right">Ganancia neta</th>
            <th className="px-4 py-3 text-right">Margen</th><th className="px-4 py-3 text-right">ROI</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {report.rows.map((row) => <tr key={row.key}>
              <td className="whitespace-nowrap px-4 py-3 font-medium">{row.label}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.estimated ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'}`}>{row.estimated ? 'Estimado' : 'Real conciliado'}</span></td>
              <td className="px-4 py-3 text-right">{row.orders}</td><td className="px-4 py-3 text-right">{money(row.revenue)}</td><td className="px-4 py-3 text-right">{money(row.supplierCost)}</td>
              <td className="px-4 py-3 text-right">{money(row.marketplaceFees)}</td><td className="px-4 py-3 text-right">{money(row.shipping)}</td><td className="px-4 py-3 text-right">{money(row.taxes)}</td>
              <td className="px-4 py-3 text-right font-semibold">{money(row.netProfit)}</td><td className="px-4 py-3 text-right">{percent(row.margin)}</td><td className="px-4 py-3 text-right">{percent(row.roi)}</td>
            </tr>)}
            {!report.rows.length && <tr><td colSpan={11} className="px-4 py-10 text-center text-gray-500">No hay órdenes para este período.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </main>;
}
