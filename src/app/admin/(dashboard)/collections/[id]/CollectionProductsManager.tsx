import {
  addCollectionProductAction,
  moveCollectionProductAction,
  removeCollectionProductAction,
} from '../actions';

type AssignedProduct = {
  productId: string;
  product: {
    id: string;
    title: string;
    displayTitle: string | null;
    status: string;
  };
};

type AvailableProduct = {
  id: string;
  title: string;
  displayTitle: string | null;
  status: string;
};

export default function CollectionProductsManager({
  collectionId,
  assigned,
  available,
}: {
  collectionId: string;
  assigned: AssignedProduct[];
  available: AvailableProduct[];
}) {
  const add = addCollectionProductAction.bind(null, collectionId);

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Productos de la colección</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Asigná productos y definí el orden exacto de la landing.</p>
      </div>

      {available.length ? (
        <form action={add} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Agregar producto
            <select name="productId" required defaultValue="" className="mt-1 block w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
              <option value="" disabled>Seleccioná un producto</option>
              {available.map((product) => (
                <option key={product.id} value={product.id}>{product.displayTitle || product.title} · {product.status}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="self-end rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">Agregar</button>
        </form>
      ) : null}

      {assigned.length ? (
        <ol className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {assigned.map((item, index) => {
            const moveUp = moveCollectionProductAction.bind(null, collectionId, item.productId, 'up');
            const moveDown = moveCollectionProductAction.bind(null, collectionId, item.productId, 'down');
            const remove = removeCollectionProductAction.bind(null, collectionId, item.productId);
            return (
              <li key={item.productId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">{item.product.displayTitle || item.product.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.product.status}</p>
                </div>
                <div className="flex gap-2">
                  <form action={moveUp}><button type="submit" disabled={index === 0} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700">Subir</button></form>
                  <form action={moveDown}><button type="submit" disabled={index === assigned.length - 1} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700">Bajar</button></form>
                  <form action={remove}><button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300">Quitar</button></form>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="font-medium text-gray-900 dark:text-white">La colección todavía no tiene productos.</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Agregá uno para comenzar a definir el orden editorial.</p>
        </div>
      )}
    </section>
  );
}

