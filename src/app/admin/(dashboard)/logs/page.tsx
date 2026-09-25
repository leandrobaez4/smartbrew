import { IntegrationLogStatus } from '@prisma/client';
import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { findIntegrationLogs } from '@/lib/integration-logs';
import { portalDb, requireAdmin } from '@/lib/portal';
import QueueTester from './QueueTester';

export const dynamic = 'force-dynamic';

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ provider?: string; operation?: string }> }) {
  await requireAdmin();
  const filters = await searchParams;
  const provider = filters.provider?.trim().slice(0, 128) || '';
  const operation = filters.operation?.trim().slice(0, 128) || '';
  const logs = await portalDb.systemLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100, // Show last 100 logs
  });
  const integrationLogs = await findIntegrationLogs({ provider: provider || undefined, operation: operation || undefined });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Registros del Sistema</h1>

      <QueueTester />

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Integraciones de proveedores</h2>
            <p className="text-sm text-gray-500">Requests y responses sanitizados, sin credenciales ni datos de tarjetas.</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" action="/admin/logs">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Proveedor
              <input name="provider" defaultValue={provider} maxLength={128} className="mt-1 block rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" placeholder="supplier-slug" />
            </label>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Operación
              <input name="operation" defaultValue={operation} maxLength={128} className="mt-1 block rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950" placeholder="getPrice" />
            </label>
            <button className="rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white dark:bg-gray-100 dark:text-gray-900">Filtrar</button>
          </form>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950"><tr>{['Estado', 'Proveedor', 'Operación', 'Request / Response', 'Duración', 'Fecha'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {integrationLogs.map((log) => <tr key={log.id}>
                <td className={`px-4 py-3 text-xs font-semibold ${log.status === IntegrationLogStatus.ERROR ? 'text-red-600' : 'text-green-600'}`}>{log.status}</td>
                <td className="px-4 py-3">{log.provider}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.operation}</td>
                <td className="max-w-xl px-4 py-3"><pre className="max-h-40 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-950">{JSON.stringify({ request: log.request, response: log.response, error: log.error }, null, 2)}</pre></td>
                <td className="px-4 py-3">{log.durationMs} ms</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{log.createdAt.toLocaleString('es-AR')}</td>
              </tr>)}
              {!integrationLogs.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay operaciones para los filtros seleccionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nivel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Origen</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mensaje</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.level === 'ERROR' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      log.level === 'WARN' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {log.level === 'ERROR' && <AlertCircle size={14} />}
                      {log.level === 'WARN' && <AlertTriangle size={14} />}
                      {log.level === 'INFO' && <Info size={14} />}
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {log.source}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div className="font-medium">{log.message}</div>
                    {log.details && (
                      <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-800 overflow-x-auto text-gray-600 dark:text-gray-400">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No se encontraron registros del sistema.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
