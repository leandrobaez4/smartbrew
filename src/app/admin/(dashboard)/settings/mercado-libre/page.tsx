import { mercadoLibreOAuthConfig } from '@/lib/mercado-libre-oauth';
import { portalDb, requireAdmin } from '@/lib/portal';
import { connectMercadoLibreAction, disconnectMercadoLibreAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function MercadoLibreSettingsPage({ searchParams }: {
  searchParams: Promise<{ connected?: string; disconnected?: string; error?: string }>;
}) {
  await requireAdmin('/admin/settings/mercado-libre');
  const query = await searchParams;
  const credential = await portalDb.marketplaceOAuthCredential.findFirst({
    where: { marketplace: 'MERCADO_LIBRE' },
    orderBy: { updatedAt: 'desc' },
    select: { accountId: true, scope: true, expiresAt: true, lastRefreshAt: true, lastRefreshError: true },
  });
  let configured = true;
  try { mercadoLibreOAuthConfig(); } catch { configured = false; }

  return <main className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-sm font-semibold text-yellow-600">Integraciones</p><h1 className="text-2xl font-bold">Mercado Libre OAuth</h1><p className="mt-1 text-sm text-gray-500">Conectá la cuenta vendedora y SmartBrew renovará sus tokens automáticamente.</p></header>
    {query.connected && <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">Cuenta conectada correctamente.</p>}
    {query.disconnected && <p className="rounded bg-blue-50 p-3 text-sm text-blue-800">La cuenta quedó desconectada de SmartBrew.</p>}
    {query.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">No se pudo completar la autorización. Volvé a intentarlo.</p>}
    {!configured && <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Falta configurar MERCADO_LIBRE_CLIENT_ID y MERCADO_LIBRE_CLIENT_SECRET en el servidor.</p>}
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {credential ? <div className="space-y-4">
        <dl className="grid gap-4 text-sm md:grid-cols-2">
          <div><dt className="text-gray-500">Cuenta</dt><dd className="font-semibold">{credential.accountId}</dd></div>
          <div><dt className="text-gray-500">Token vigente hasta</dt><dd className="font-semibold">{credential.expiresAt.toLocaleString('es-AR')}</dd></div>
          <div><dt className="text-gray-500">Scopes</dt><dd>{credential.scope || 'No informados'}</dd></div>
          <div><dt className="text-gray-500">Última renovación</dt><dd>{credential.lastRefreshAt?.toLocaleString('es-AR') || 'Todavía no renovado'}</dd></div>
        </dl>
        {credential.lastRefreshError && <p className="rounded bg-red-50 p-3 text-sm text-red-800">Último error de renovación: {credential.lastRefreshError}</p>}
        <div className="flex flex-wrap gap-3"><form action={connectMercadoLibreAction}><button disabled={!configured} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Reconectar cuenta</button></form><form action={disconnectMercadoLibreAction}><button className="rounded border border-red-300 px-4 py-2 font-semibold text-red-700">Desconectar</button></form></div>
      </div> : <div><h2 className="font-bold">Cuenta no conectada</h2><p className="mt-1 text-sm text-gray-500">La autorización estática queda disponible sólo como transición; OAuth es el mecanismo recomendado.</p><form action={connectMercadoLibreAction} className="mt-4"><button disabled={!configured} className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Conectar Mercado Libre</button></form></div>}
    </section>
  </main>;
}
