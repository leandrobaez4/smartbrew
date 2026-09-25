import { notFound } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import SupplierForm from '../SupplierForm';
import { deleteSupplierAction, syncSupplierAction, updateSupplierAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditSupplierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supplier = await portalDb.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();
  const update = updateSupplierAction.bind(null, id);
  const sync = syncSupplierAction.bind(null, id);
  const remove = deleteSupplierAction.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editar proveedor</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Las credenciales guardadas permanecen ocultas.</p></div><div className="flex gap-2"><form action={sync}><button type="submit" className="rounded-md border border-gray-300 px-4 py-2 font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">Sincronizar</button></form><form action={remove}><button type="submit" className="rounded-md border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">Eliminar</button></form></div></div>
      <SupplierForm action={update} supplier={supplier} error={query.error} saved={query.saved === '1'} />
    </div>
  );
}
