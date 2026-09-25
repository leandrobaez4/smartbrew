import { requireAdmin } from '@/lib/portal';
import { decodeElitImportPayload } from '@/lib/elit-import';
import PricingCalculatorForm from './PricingCalculatorForm';
import { importElitProductAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function ElitImportPage({ searchParams }: {
  searchParams: Promise<{ payload?: string; error?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const payload = query.payload || '';
  const product = decodeElitImportPayload(payload);

  if (!product) return <main className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
    <h1 className="text-xl font-bold">No se pudo leer el producto de Elit</h1>
    <p className="mt-2 text-sm">Volvé a la página del producto, recargá la extensión y extraelo nuevamente.</p>
  </main>;
  if (!product.pricing.supplierPriceUsd || !product.pricing.exchangeRateArsPerUsd) return <main className="mx-auto max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
    <h1 className="text-xl font-bold">Faltan el precio o el tipo de cambio</h1>
    <p className="mt-2 text-sm">Iniciá sesión en Elit para que la página muestre ambos valores y repetí la extracción.</p>
  </main>;

  const save = importElitProductAction.bind(null, payload);
  return <main className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-sm font-semibold text-yellow-600">Dropshipping · Elit</p>
      <h1 className="text-2xl font-bold">Configurar costo y precio de publicación</h1>
      <p className="mt-1 text-sm text-gray-500">{product.title} · Código {product.externalId} · SKU {product.sku || '—'}</p>
    </header>
    {query.error && <p className="rounded bg-red-50 p-3 text-sm text-red-800">Revisá los valores del cálculo.</p>}
    <PricingCalculatorForm action={save} initial={{
      supplierPriceUsd: product.pricing.supplierPriceUsd,
      exchangeRateArsPerUsd: product.pricing.exchangeRateArsPerUsd,
      vatPercentage: product.pricing.vatPercentage,
      productSearchCostArs: 0,
      shippingCostArs: 0,
      marketplaceFeePercentage: 13,
      marketplaceFixedFeeArs: 0,
      marketplaceCategoryId: '',
      marketplaceListingTypeId: 'gold_special',
      targetMarginPercentage: 20,
    }} />
  </main>;
}
