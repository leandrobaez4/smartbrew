'use client';

import { useState } from 'react';

export default function PublishOpportunityButton({ productId, accountId, costs, disabled }: {
  productId: string;
  accountId: string;
  costs: { marketplaceFee: number; shippingCost: number; taxes: number; extraCosts: number; targetMarginPercentage: number };
  disabled?: boolean;
}) {
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

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
      const result = await response.json() as { error?: string };
      setStatus(response.ok ? 'Publicación encolada. El worker la procesará en segundo plano.' : result.error || 'No se pudo publicar.');
    } catch {
      setStatus('No se pudo conectar con SmartBrew.');
    } finally {
      setPending(false);
    }
  }

  return <div className="min-w-40"><button type="button" disabled={disabled || pending} onClick={publish} className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-gray-950 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Encolando…' : 'Publicar en ML'}</button>{status && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400" role="status">{status}</p>}</div>;
}
