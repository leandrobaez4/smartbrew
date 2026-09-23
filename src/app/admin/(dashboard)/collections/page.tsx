import Link from 'next/link';
import { portalDb, requireAdmin } from '@/lib/portal';
import { deleteCollectionAction, setCollectionPublishedAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  await requireAdmin();
  const collections = await portalDb.collection.findMany({
    orderBy: [{ published: 'desc' }, { updatedAt: 'desc' }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Colecciones</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Curadurías editoriales para campañas y landings.</p>
        </div>
        <Link href="/admin/collections/new" className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Nueva colección</Link>
      </div>

      {collections.length ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-5 py-3">Colección</th>
                <th className="px-5 py-3">Productos</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {collections.map((collection) => {
                const toggle = setCollectionPublishedAction.bind(null, collection.id, !collection.published);
                const remove = deleteCollectionAction.bind(null, collection.id);
                return (
                  <tr key={collection.id}>
                    <td className="px-5 py-4">
                      <Link href={`/admin/collections/${collection.id}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{collection.title}</Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">/{collection.slug}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{collection._count.products}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${collection.published ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {collection.published ? 'Publicada' : 'Borrador'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <form action={toggle}>
                          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800" type="submit">
                            {collection.published ? 'Despublicar' : 'Publicar'}
                          </button>
                        </form>
                        <form action={remove}>
                          <button className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" type="submit">Eliminar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-white">Todavía no hay colecciones</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Creá la primera para empezar a curar productos.</p>
        </div>
      )}
    </div>
  );
}

