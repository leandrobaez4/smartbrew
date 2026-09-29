import { decodeUnidropImportPayload } from '@/lib/unidrop-import';
import { requireAdmin } from '@/lib/portal';
import { importSupplierSnapshotAction } from './actions';

export const dynamic = 'force-dynamic';

function money(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

export default async function SupplierImportPage({ searchParams }: {
  searchParams: Promise<{ payload?: string; error?: string }>;
}) {
  const query = await searchParams;
  const payload = query.payload || '';
  const returnTo = `/admin/suppliers/import?payload=${encodeURIComponent(payload)}`;
  await requireAdmin(returnTo);
  const product = decodeUnidropImportPayload(payload);

  if (!product) return <main className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
    <p className="text-sm font-semibold">Dropshipping · Importación</p>
    <h1 className="mt-1 text-xl font-bold">No se pudo leer el producto de Unidrop</h1>
    <p className="mt-2 text-sm">Volvé a la ficha del producto, recargá la extensión y extraelo nuevamente.</p>
  </main>;

  const save = importSupplierSnapshotAction.bind(null, payload);
  return <main className="mx-auto max-w-4xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-yellow-600">Dropshipping · Unidrop</p>
      <h1 className="text-2xl font-bold">Confirmar producto para SmartBrew</h1>
      <p className="mt-1 text-sm text-gray-500">Revisá el snapshot comercial antes de incorporarlo a oportunidades.</p>
    </header>
    {query.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">El snapshot no es válido. Extraé nuevamente el producto.</p>}
    <section className="grid gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Producto</p>
        <h2 className="mt-1 text-xl font-bold">{product.title}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Identidad</dt><dd className="font-medium">{product.externalId}</dd></div>
          <div><dt className="text-gray-500">SKU</dt><dd className="font-medium">{product.sku}</dd></div>
          <div><dt className="text-gray-500">Costo</dt><dd className="font-medium">{money(product.costArs)}</dd></div>
          <div><dt className="text-gray-500">Stock</dt><dd className="font-medium">{product.stock}</dd></div>
          <div><dt className="text-gray-500">Categoría</dt><dd className="font-medium">{product.category || '—'}</dd></div>
          <div><dt className="text-gray-500">Imágenes</dt><dd className="font-medium">{product.images.length}</dd></div>
        </dl>
      </div>
      <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-950">
        <h3 className="font-semibold">Qué se guardará</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-600 dark:text-gray-300">
          <li>Origen Unidrop y SKU estable.</li>
          <li>Costo, stock, ficha e imágenes del snapshot.</li>
          <li>Medidas y peso para calcular el envío antes de publicar.</li>
          <li>Historial sólo si cambia el costo o el stock.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">El costo de envío de Tiendanube queda sólo como referencia; no se usa como costo de Mercado Libre.</p>
      </div>
    </section>
    <form action={save} className="flex justify-end">
      <button className="rounded bg-yellow-500 px-5 py-3 font-semibold text-gray-950 hover:bg-yellow-400">Guardar en oportunidades</button>
    </form>
  </main>;
}
