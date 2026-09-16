'use client';

import { useState } from 'react';
import { inspectFacebookInstagramAction } from '../actions';

type Result = Awaited<ReturnType<typeof inspectFacebookInstagramAction>>;
export default function FacebookInstagramVerification({ productId, publications }: {
  productId: string; publications: { id: string; mediaId: string | null }[];
}) {
  const [selected, setSelected] = useState(publications[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  async function verify(withPublication: boolean) {
    setBusy(true); setResult(null);
    try { setResult(await inspectFacebookInstagramAction(productId, withPublication ? selected : undefined)); }
    catch { setResult({ success: false, message: 'No se pudo conectar con SmartBrew. Intentá nuevamente.' }); }
    finally { setBusy(false); }
  }
  const button = 'cursor-pointer rounded bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50';
  return <section className="my-6 rounded-lg border border-gray-300 p-4 dark:border-gray-700 space-y-3">
    <h2 className="text-lg font-semibold">Verificación de Instagram mediante Facebook</h2>
    <p className="text-sm">Consulta en vivo la cuenta configurada para eliminación y el propietario de una publicación. Solo lectura: no publica, elimina ni cambia registros.</p>
    <button type="button" className={button} disabled={busy} onClick={() => verify(false)}>Verificar cuenta</button>
    {publications.length > 0 ? <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="facebook-publication">Publicación registrada</label>
      <select id="facebook-publication" className="max-w-full rounded border p-2 bg-white dark:bg-gray-900" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setResult(null); }}>
        {publications.map(p => <option key={p.id} value={p.id}>{p.mediaId || 'Sin ID remoto'} — {p.id}</option>)}
      </select>
      <button type="button" className={button} disabled={busy || !selected} onClick={() => verify(true)}>Verificar publicación</button>
    </div> : <p className="text-sm">No hay publicaciones activas registradas para este producto. Podés verificar la cuenta.</p>}
    <div aria-live="polite" aria-busy={busy}>
      {busy && <p>Consultando Meta…</p>}
      {result && (!result.success ? <p role="alert" className="text-red-600 dark:text-red-400">{result.message}</p> : <div className="space-y-1 break-words">
        <p>Cuenta consultada: <strong>@{result.account.username}</strong></p>
        <p>ID de Instagram: {result.account.id}</p>
        <p>Origen: Facebook Graph API · Facebook Login</p>
        {result.publication && <>
          <p>ID de publicación: {result.publication.id}</p>
          <p>ID del propietario: {result.publication.ownerId}</p>
          <p className={result.publication.matches ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{result.publication.matches ? 'Propiedad verificada: pertenece a la cuenta configurada.' : 'Propietario diferente: no se confirmó la pertenencia a esta cuenta.'}</p>
        </>}
        <p className="text-sm">Consultado: {new Date(result.checkedAt).toLocaleString()}. Es una comprobación puntual; la eliminación vuelve a verificar la propiedad.</p>
      </div>)}
    </div>
  </section>;
}
