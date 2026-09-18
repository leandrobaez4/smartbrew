'use client';
import { useEffect, useState } from 'react';
import { createProductAdAction, getProductAdState } from './ad-actions';
import { productUrl } from '@/lib/product-url';

export default function ProductAdForm({ productId }: { productId: string }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof getProductAdState>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    try { setState(await getProductAdState(productId)); } catch { setMessage('No se pudo consultar el estado.'); }
  }
  useEffect(() => { let active = true; getProductAdState(productId).then(result => { if (active) setState(result); }).catch(() => { if (active) setMessage('No se pudo consultar el estado.'); }); return () => { active = false; }; }, [productId]);
  return <details className="my-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <summary className="cursor-pointer font-semibold">Crear anuncio de Instagram (pausado)</summary>
    <p className="mt-3 text-sm">Primera versión: portada del producto, botón Comprar ahora, destino a la ficha pública. Público: Argentina, mayores de 18 años; ubicación: feed de Instagram. La activación se hace manualmente en Meta.</p>
    <p className="my-2 break-all text-xs">Destino: {productUrl(productId)}</p>
    {!state?.enabled && <p className="text-sm text-amber-600">Falta habilitar Marketing API y configurar META_ADS en el servidor. No se enviarán anuncios.</p>}
    {state?.job ? <div className="my-3 space-y-2 text-sm">
      <p>Intento: {state.job.id}</p>
      <p>Estado: {state.job.interrupted ? 'Interrumpido o sin entrega: requiere revisión' : state.job.status === 'SUCCEEDED' ? 'Creado pausado. Revisá y activá en Meta cuando corresponda.' : state.job.status === 'FAILED' ? 'Requiere revisión' : 'En cola / creando'}</p>
      {state.job.error && <p role="alert">{state.job.error}</p>}
      {state.job.ids.map(id => <p className="font-mono text-xs" key={id}>{id}</p>)}
    </div> : <form className="mt-4 space-y-3" action={async form => {
      if (busy) return;
      const amount = String(form.get('budget') || '').replace(',', '.');
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) { setMessage('Ingresá un presupuesto con hasta dos decimales.'); return; }
      if (!confirm('¿Crear este anuncio PAUSADO en Meta con el presupuesto y duración indicados? No se activará automáticamente.')) return;
      setBusy(true);
      try {
        const result = await createProductAdAction({ productId, currency: form.get('currency'), budgetMinor: Math.round(Number(amount) * 100), days: Number(form.get('days')), confirmed: form.get('confirmed') === 'on' });
        setMessage(result.message);
        await refresh();
      } catch { setMessage('No se confirmó la operación. Actualizá el estado antes de repetir.'); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm">Moneda de tu cuenta publicitaria
        <select name="currency" required className="ml-2 rounded border p-2 dark:bg-gray-950"><option value="ARS">ARS</option><option value="USD">USD</option></select>
      </label>
      <label className="block text-sm">Presupuesto total (no diario)
        <input name="budget" type="number" min="1" max="1000000" step="0.01" required className="mt-1 block w-full rounded border p-2 dark:bg-gray-950" />
      </label>
      <label className="block text-sm">Duración en días (1–30)
        <input name="days" type="number" min="1" max="30" step="1" required className="mt-1 block w-full rounded border p-2 dark:bg-gray-950" />
      </label>
      <p className="text-xs">La programación empieza una hora después de crearlo. Si lo activás más tarde, revisá las fechas y el presupuesto en Meta. La aprobación y los mínimos dependen de Meta.</p>
      <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" required /> Revisé la portada, la ficha pública, el público y el presupuesto. Autorizo crear el anuncio pausado, no activarlo.</label>
      <button disabled={busy || !state?.enabled} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Encolando…' : 'Crear anuncio pausado'}</button>
    </form>}
    <button type="button" disabled={busy} onClick={refresh} className="mt-3 text-sm text-blue-600 hover:underline">Actualizar estado del anuncio</button>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </details>;
}
