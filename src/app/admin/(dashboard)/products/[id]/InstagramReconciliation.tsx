'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { reconcileInstagramPublicationAction } from '../actions';
import { runPublicationAction } from '@/lib/publication-client';

export default function InstagramReconciliation({ productId, publicationId, mediaId }: { productId: string; publicationId: string; mediaId: string | null }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <details className="mt-4 rounded-md border border-amber-400 p-3 text-sm">
      <summary className="cursor-pointer font-medium">Conciliar registro de Instagram</summary>
      <p className="mt-2 break-all">ID registrado: {mediaId || 'Sin ID'} · Registro: {publicationId}</p>
      <p className="mt-2">Esta opción retira solo el registro activo de SmartBrew y conserva su historial. No elimina el post ni confirma que Meta lo haya eliminado. Revisá la cuenta correcta antes: volver a publicar podría generar un duplicado.</p>
      <label className="mt-3 block">
        Motivo de la conciliación (sin tokens ni credenciales)
        <textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={1000} disabled={pending} className="mt-1 block w-full rounded border p-2 dark:bg-gray-950" />
      </label>
      <label className="mt-3 flex gap-2">
        <input type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} />
        Revisé la cuenta y autorizo retirar este registro, sin confirmación de eliminación de Meta.
      </label>
      <button type="button" disabled={pending || !confirmed || reason.trim().length < 10} className="mt-3 cursor-pointer rounded border border-amber-600 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50" onClick={async () => {
        if (!confirm(`¿Retirar administrativamente el registro ${publicationId} (Meta: ${mediaId || 'sin ID'})? Esto no elimina nada en Instagram y una nueva publicación podría duplicar un post existente.`)) return;
        setPending(true);
        const result = await runPublicationAction(() => reconcileInstagramPublicationAction(productId, publicationId, reason, confirmed));
        setMessage(result.message || 'No se pudo completar la conciliación.');
        setPending(false);
        if (result.success) router.refresh();
      }}>{pending ? 'Conciliando…' : 'Retirar registro de SmartBrew'}</button>
      <p role="status" className="mt-2">{message}</p>
    </details>
  );
}
