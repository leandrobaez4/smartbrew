'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PublishResult = { error?: string; jobId?: string };
type JobResult = { status?: 'STARTED' | 'SUCCEEDED' | 'FAILED'; error?: string | null; dryRun?: boolean };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function json<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

export default function PublishOpportunityButton({ productId, accountId, costs, disabledReason, reviewHref }: {
  productId: string;
  accountId: string;
  costs: { marketplaceFee: number; shippingCost: number; taxes: number; extraCosts: number; targetMarginPercentage: number };
  disabledReason?: string | null;
  reviewHref?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

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
        router.refresh();
        return;
      }
    }
    setStatus('La publicación sigue procesándose. Consultá nuevamente en unos instantes.');
  }

  async function publish() {
    if (!confirm('¿Iniciar la publicación de este producto en Mercado Libre? Esta acción crea una publicación real.')) return;
    setPending(true);
    setStatus('');
    try {
      const response = await fetch(`/api/supplier-products/${encodeURIComponent(productId)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceAccountId: accountId, ...costs }),
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
    : <button type="button" disabled={Boolean(disabledReason) || pending} title={disabledReason || undefined} onClick={publish} className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-gray-950 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Publicando…' : 'Publicar en ML'}</button>}{disabledReason && <p className="mt-1 max-w-56 text-xs text-amber-700 dark:text-amber-400">{disabledReason}</p>}{status && <p className="mt-1 max-w-56 text-xs text-gray-600 dark:text-gray-400" role="status">{status}</p>}</div>;
}
