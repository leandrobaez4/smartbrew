'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PublishResult = { error?: string; jobId?: string };
type JobResult = { status?: 'STARTED' | 'SUCCEEDED' | 'FAILED'; error?: string | null; dryRun?: boolean };
type PackageValues = { heightCm?: number; widthCm?: number; lengthCm?: number; weightGrams?: number };
type QuoteResult = {
  error?: string;
  shippingCostArs: number;
  finalPriceArs: number;
  marketplaceFeeAmountArs: number;
  targetProfitArs: number;
  marginPercentage: number;
  roiPercentage: number;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function json<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

export default function PublishOpportunityButton({ productId, accountId, costs, packageDefaults, disabledReason, reviewHref }: {
  productId: string;
  accountId: string;
  costs: { marketplaceFee: number; shippingCost: number; taxes: number; extraCosts: number; targetMarginPercentage: number };
  packageDefaults: PackageValues;
  disabledReason?: string | null;
  reviewHref?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [dimensions, setDimensions] = useState({
    heightCm: packageDefaults.heightCm ? String(Math.round(packageDefaults.heightCm)) : '',
    widthCm: packageDefaults.widthCm ? String(Math.round(packageDefaults.widthCm)) : '',
    lengthCm: packageDefaults.lengthCm ? String(Math.round(packageDefaults.lengthCm)) : '',
    weightGrams: packageDefaults.weightGrams ? String(Math.round(packageDefaults.weightGrams)) : '',
  });

  const packageData = () => ({
    heightCm: Number(dimensions.heightCm),
    widthCm: Number(dimensions.widthCm),
    lengthCm: Number(dimensions.lengthCm),
    weightGrams: Number(dimensions.weightGrams),
  });

  function updateDimension(name: keyof typeof dimensions, value: string) {
    setDimensions((current) => ({ ...current, [name]: value }));
    setQuote(null);
    setStatus('');
  }

  async function calculateShipping() {
    setQuoting(true);
    setStatus('');
    try {
      const response = await fetch(`/api/supplier-products/${encodeURIComponent(productId)}/shipping-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceAccountId: accountId, ...packageData() }),
      });
      const result = await json<QuoteResult>(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo calcular el envío.');
      setQuote(result);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo calcular el envío.');
    } finally {
      setQuoting(false);
    }
  }

  async function waitForResult(jobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await delay(1_500);
      const response = await fetch(`/api/supplier-products/${encodeURIComponent(productId)}/publish?jobId=${encodeURIComponent(jobId)}`, {
        cache: 'no-store',
      });
      const result = await json<JobResult>(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar el estado de la publicación.');
      if (result.status === 'FAILED') throw new Error(result.error || 'Mercado Libre no pudo completar la publicación.');
      if (result.status === 'SUCCEEDED') {
        setStatus(result.dryRun
          ? 'Simulación completada. DROPSHIPPING_DRY_RUN está activo y no se creó una publicación real.'
          : 'Producto publicado correctamente en Mercado Libre.');
        setOpen(false);
        router.refresh();
        return;
      }
    }
    setStatus('La publicación sigue procesándose. Consultá nuevamente en unos instantes.');
  }

  async function publish() {
    if (!quote) return;
    setPending(true);
    setStatus('');
    try {
      const response = await fetch(`/api/supplier-products/${encodeURIComponent(productId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceAccountId: accountId, ...costs, shippingCost: quote.shippingCostArs, ...packageData() }),
      });
      const result = await json<PublishResult>(response);
      if (!response.ok || !result.jobId) throw new Error(result.error || 'No se pudo encolar la publicación.');
      setStatus('Publicación encolada. Esperando la respuesta de Mercado Libre…');
      await waitForResult(result.jobId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo conectar con SmartBrew.');
    } finally {
      setPending(false);
    }
  }

  return <div className="min-w-48">{reviewHref && disabledReason
    ? <Link href={reviewHref} className="inline-block rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">Revisar y aprobar</Link>
    : <button type="button" disabled={Boolean(disabledReason) || pending} title={disabledReason || undefined} onClick={() => setOpen(true)} className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-gray-950 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">Publicar en ML</button>}{disabledReason && <p className="mt-1 max-w-56 text-xs text-amber-700 dark:text-amber-400">{disabledReason}</p>}{!open && status && <p className="mt-1 max-w-56 text-xs text-gray-600 dark:text-gray-400" role="status">{status}</p>}
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby={`shipping-title-${productId}`}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4"><div><h2 id={`shipping-title-${productId}`} className="text-xl font-bold">Calcular envío y precio final</h2><p className="mt-1 text-sm text-gray-500">Mercado Libre calcula el envío con las medidas del paquete. El peso se completa desde Elit cuando está disponible.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-xl text-gray-500" aria-label="Cerrar">×</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <PackageField label="Alto del paquete (cm)" value={dimensions.heightCm} max={500} onChange={(value) => updateDimension('heightCm', value)} />
          <PackageField label="Ancho del paquete (cm)" value={dimensions.widthCm} max={500} onChange={(value) => updateDimension('widthCm', value)} />
          <PackageField label="Largo del paquete (cm)" value={dimensions.lengthCm} max={500} onChange={(value) => updateDimension('lengthCm', value)} />
          <PackageField label="Peso del paquete (g)" value={dimensions.weightGrams} max={500000} onChange={(value) => updateDimension('weightGrams', value)} />
        </div>
        <button type="button" onClick={calculateShipping} disabled={quoting || pending} className="mt-5 rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{quoting ? 'Consultando Mercado Libre…' : 'Calcular envío y precio'}</button>
        {quote && <dl className="mt-5 grid gap-3 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-950 sm:grid-cols-3">
          <Metric label="Costo de nuestro lado" value={money(quote.shippingCostArs)} />
          <Metric label="Comisión ML" value={money(quote.marketplaceFeeAmountArs)} />
          <Metric label="Ganancia" value={money(quote.targetProfitArs)} />
          <Metric label="Margen" value={`${quote.marginPercentage.toFixed(2)}%`} />
          <Metric label="ROI" value={`${quote.roiPercentage.toFixed(2)}%`} />
          <Metric label="Precio final" value={money(quote.finalPriceArs)} strong />
        </dl>}
        {status && <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">{status}</p>}
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded border border-gray-300 px-4 py-2 dark:border-gray-700">Cancelar</button><button type="button" onClick={publish} disabled={!quote || pending} className="rounded bg-yellow-500 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">{pending ? 'Publicando…' : quote ? `Publicar por ${money(quote.finalPriceArs)}` : 'Calculá antes de publicar'}</button></div>
      </div>
    </div>}
  </div>;
}

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

function PackageField({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input type="number" min="1" max={max} step="1" required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950" /></label>;
}

function Metric({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><dt className="text-xs uppercase text-gray-500">{label}</dt><dd className={strong ? 'mt-1 text-lg font-bold text-blue-700 dark:text-blue-300' : 'mt-1 font-semibold'}>{value}</dd></div>;
}
