import { AlertType } from '@prisma/client';
import { portalDb, requireAdmin } from '@/lib/portal';
import { markAlertRead } from './actions';

export const dynamic = 'force-dynamic';

const labels: Record<AlertType, string> = {
  SUPPLIER_OUT_OF_STOCK: 'Proveedor sin stock',
  SUPPLIER_PRICE_INCREASE: 'Aumento de precio',
  LOW_MARGIN: 'Margen bajo',
  PRICE_ANOMALY: 'Anomalía de precio',
  SUPPLIER_API_ERROR: 'Error de proveedor',
  ORDER_CREATION_ERROR: 'Error al crear orden',
  MARKETPLACE_SYNC_ERROR: 'Error de marketplace',
};

export default async function AlertsPage() {
  await requireAdmin();
  const alerts = await portalDb.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 250 });
  const unread = alerts.filter((alert) => !alert.readAt).length;

  return <div className="mx-auto max-w-6xl">
    <div className="mb-6">
      <p className="text-sm font-semibold text-yellow-600">Dropshipping</p>
      <h1 className="text-3xl font-bold">Alertas</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{unread} sin leer · últimas {alerts.length} alertas</p>
    </div>
    <div className="space-y-3">
      {alerts.map((alert) => <article key={alert.id} className={`rounded-lg border p-4 shadow-sm ${alert.readAt ? 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900' : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-900 px-2 py-1 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">{labels[alert.type]}</span>
              <span className="text-xs font-medium text-gray-500">{alert.readAt ? 'Leída' : 'Sin leer'}</span>
            </div>
            <p className="mt-2 font-semibold">{alert.message}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Origen: {alert.origin}{alert.entityType && alert.entityId ? ` · ${alert.entityType}: ${alert.entityId}` : ''}</p>
            <time className="mt-1 block text-xs text-gray-500">{alert.createdAt.toLocaleString('es-AR')}</time>
          </div>
          {!alert.readAt && <form action={markAlertRead.bind(null, alert.id)}>
            <button type="submit" className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold hover:bg-white dark:border-gray-700 dark:hover:bg-gray-900">Marcar como leída</button>
          </form>}
        </div>
      </article>)}
      {!alerts.length && <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">No hay alertas registradas.</div>}
    </div>
  </div>;
}
