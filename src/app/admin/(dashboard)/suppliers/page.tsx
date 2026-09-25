import { SupplierStatus } from '@prisma/client';
import Link from 'next/link';
import { portalDb, requireAdmin } from '@/lib/portal';
import { deleteSupplierAction, setSupplierStatusAction, syncSupplierAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  await requireAdmin();
  const suppliers = await portalDb.supplier.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Integraciones externas y sincronización de catálogos.</p>
        </div>
        <Link href="/admin/suppliers/new" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Nuevo proveedor</Link>
      </div>

      {suppliers.length ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950"><tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><th className="px-5 py-3">Proveedor</th><th className="px-5 py-3">Integración</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Última sincronización</th><th className="px-5 py-3 text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {suppliers.map((supplier) => {
                const toggle = setSupplierStatusAction.bind(null, supplier.id, supplier.status === SupplierStatus.ACTIVE ? SupplierStatus.INACTIVE : SupplierStatus.ACTIVE);
                const sync = syncSupplierAction.bind(null, supplier.id);
                const remove = deleteSupplierAction.bind(null, supplier.id);
                return (
                  <tr key={supplier.id}>
                    <td className="px-5 py-4"><Link href={`/admin/suppliers/${supplier.id}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{supplier.name}</Link><p className="text-sm text-gray-500 dark:text-gray-400">{supplier.slug}</p></td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{supplier.integrationType}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{supplier.status}</td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{supplier.lastSyncAt?.toLocaleString('es-AR') || 'Nunca'}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2"><form action={sync}><button className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">Sincronizar</button></form><form action={toggle}><button className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">{supplier.status === SupplierStatus.ACTIVE ? 'Desactivar' : 'Activar'}</button></form><form action={remove}><button className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">Eliminar</button></form></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900"><h2 className="font-semibold text-gray-900 dark:text-white">Todavía no hay proveedores</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Creá el primero para configurar su integración.</p></div>}
    </div>
  );
}
