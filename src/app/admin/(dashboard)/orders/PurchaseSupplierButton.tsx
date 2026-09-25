'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PurchaseSupplierButton({ orderId, disabled = false }: { orderId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function purchase() {
    if (!confirm('¿Confirmás la compra real al proveedor? Revisá antes el costo, margen, stock y dirección de envío.')) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/purchase`, { method: 'POST' });
      const body = await response.json() as { error?: string; status?: string };
      if (!response.ok) throw new Error(body.error || 'No se pudo generar la compra.');
      setMessage('Compra encolada. El worker la procesará en segundo plano.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar la compra.');
    } finally {
      setPending(false);
    }
  }

  return <div className="min-w-48">
    <button type="button" onClick={purchase} disabled={disabled || pending} className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? 'Encolando…' : 'Purchase From Supplier'}
    </button>
    {message && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400" role="status">{message}</p>}
  </div>;
}
