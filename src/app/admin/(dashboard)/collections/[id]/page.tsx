import { notFound } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import CollectionForm from '../CollectionForm';
import { deleteCollectionAction, updateCollectionAction } from '../actions';
import CollectionProductsManager from './CollectionProductsManager';

export const dynamic = 'force-dynamic';

export default async function EditCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const collection = await portalDb.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { position: 'asc' },
        include: { product: { select: { id: true, title: true, displayTitle: true, status: true } } },
      },
    },
  });
  if (!collection) notFound();
  const assignedIds = collection.products.map((item) => item.productId);
  const availableProducts = await portalDb.product.findMany({
    where: assignedIds.length ? { id: { notIn: assignedIds } } : undefined,
    orderBy: [{ displayTitle: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, displayTitle: true, status: true },
    take: 500,
  });

  const update = updateCollectionAction.bind(null, id);
  const remove = deleteCollectionAction.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Editar colección</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Actualizá contenido editorial y estado de publicación.</p>
        </div>
        <form action={remove}>
          <button type="submit" className="rounded-md border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">Eliminar</button>
        </form>
      </div>
      <CollectionForm action={update} collection={collection} error={query.error} saved={query.saved === '1'} />
      <CollectionProductsManager collectionId={id} assigned={collection.products} available={availableProducts} />
    </div>
  );
}
