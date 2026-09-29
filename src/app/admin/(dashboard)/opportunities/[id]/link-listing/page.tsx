import Link from 'next/link';
import { notFound } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import { linkMarketplaceListingAction, searchAndLinkSellerSkuAction } from './actions';

export const dynamic = 'force-dynamic';

const messages: Record<string, string> = {
  'not-found': 'No se encontró una publicación con ese SELLER_SKU.',
  reused: 'Ese MLA ya está asociado a otro producto y no puede reutilizarse.',
  'invalid-mla': 'Ingresá un MLA válido, por ejemplo MLA123456789.',
  lookup: 'Mercado Libre no pudo validar la publicación. Reintentá o revisá la conexión OAuth.',
};

export default async function LinkListingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidates?: string; error?: string }>;
}) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const product = await portalDb.supplierProduct.findUnique({ where: { id }, include: { supplier: true } });
  if (!product?.sku) notFound();
  const search = searchAndLinkSellerSkuAction.bind(null, id);
  const link = linkMarketplaceListingAction.bind(null, id);
  const candidates = (query.candidates || '').split(',').filter((value) => /^MLA\d{6,20}$/.test(value)).slice(0, 50);

  return <main className="mx-auto max-w-3xl space-y-6">
    <Link href={`/admin/opportunities/${id}`} className="text-sm font-semibold text-blue-600 dark:text-blue-400">← Volver a la oportunidad</Link>
    <header><p className="text-sm font-semibold text-yellow-600">{product.supplier.name} · Mercado Libre</p><h1 className="text-2xl font-bold">Vincular publicación por SELLER_SKU</h1><p className="mt-1 text-sm text-gray-500">SmartBrew buscará exclusivamente el SKU <strong>{product.sku}</strong> en tu cuenta conectada.</p></header>
    {query.error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">{messages[query.error] || messages.lookup}</p>}
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-bold">Búsqueda segura por SKU</h2>
      <p className="mt-1 text-sm text-gray-500">Una coincidencia se vincula automáticamente. Si hay varias, elegí el MLA correcto.</p>
      <form action={search}><button className="mt-4 rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500">Buscar {product.sku} en Mercado Libre</button></form>
      {candidates.length > 1 && <div className="mt-5 space-y-2"><p className="text-sm font-semibold">Se encontraron varias publicaciones:</p>{candidates.map((itemId) => <form action={link} key={itemId} className="flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-700"><input type="hidden" name="itemId" value={itemId} /><span className="font-mono font-semibold">{itemId}</span><button className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">Validar y vincular</button></form>)}</div>}
    </section>
    <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="font-bold">Respaldo: pegar MLA</h2><p className="mt-1 text-sm text-gray-500">Se validará que pertenezca a la misma cuenta y que no esté asociado a otro producto.</p>
      <form action={link} className="mt-4 flex flex-wrap gap-3"><input name="itemId" required pattern="MLA[0-9]{6,20}" placeholder="MLA123456789" className="min-w-64 flex-1 rounded border border-gray-300 px-3 py-2 uppercase dark:border-gray-700 dark:bg-gray-950" /><button className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white">Validar y vincular</button></form>
    </section>
  </main>;
}
