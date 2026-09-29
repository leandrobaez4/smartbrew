'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ManualSupplierPurchaseForm({ orderId, estimatedCost }: { orderId: string; estimatedCost: number }) {
  const router = useRouter();
  const [reference, setReference] = useState('');
  const [actualCost, setActualCost] = useState(String(estimatedCost));
  const [errorDetail, setErrorDetail] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(body: { action: 'complete'; reference: string; actualCost: number } | { action: 'error'; error: string }) {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/manual-purchase`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la compra manual.');
      setMessage(body.action === 'complete' ? 'Compra manual completada.' : 'Error registrado.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la compra manual.');
    } finally {
      setPending(false);
    }
  }

  return <div className="min-w-72 space-y-2">
    <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia de compra" maxLength={160} className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" />
    <input value={actualCost} onChange={(event) => setActualCost(event.target.value)} type="number" min="0" step="0.01" placeholder="Costo real total" className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" />
    <button type="button" disabled={pending || !reference.trim() || !Number.isFinite(Number(actualCost)) || Number(actualCost) < 0} onClick={() => submit({ action: 'complete', reference, actualCost: Number(actualCost) })} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Completar compra manual</button>
    <div className="flex gap-2"><input value={errorDetail} onChange={(event) => setErrorDetail(event.target.value)} placeholder="Motivo del error" maxLength={500} className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950" /><button type="button" disabled={pending || !errorDetail.trim()} onClick={() => submit({ action: 'error', error: errorDetail })} className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300">Marcar error</button></div>
    {message && <p className="text-xs text-gray-600 dark:text-gray-400" role="status">{message}</p>}
  </div>;
}
