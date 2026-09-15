'use client';
import { useActionState, useId, useState } from 'react';
import { disconnectInstagram } from './actions';

export default function DisconnectForm({ connectionId, username, version }: { connectionId: string; username: string; version: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(disconnectInstagram, { error: '' });
  const panelId = useId();
  const button = 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-wait disabled:opacity-50';
  return <div className="space-y-3">
    <button type="button" className={button} aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(true)}>Desconectar Instagram</button>
    {expanded && <form id={panelId} action={action} className="rounded-lg border border-red-800 p-4 space-y-4" aria-label={`Confirmar desconexión de @${username}`}>
      <h3 className="font-semibold">¿Desconectar @{username} de SmartBrew?</h3>
      <p>Se eliminarán la conexión y el token guardado en este portal. Conservás tu usuario de SmartBrew y podés volver a conectar Instagram.</p>
      <p>No elimina tu cuenta de Instagram ni retira la autorización que Meta recuerda. Tampoco cancela suscripciones ni modifica el bot de producción.</p>
      <input type="hidden" name="connectionId" value={connectionId} />
      <input type="hidden" name="version" value={version} />
      <label className="flex gap-2 items-start"><input type="checkbox" name="confirm" value="yes" required disabled={pending} className="mt-1" />Entiendo que se eliminará la conexión guardada.</label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={button} disabled={pending}>{pending ? 'Desconectando…' : 'Confirmar desconexión'}</button>
        <button type="button" disabled={pending} className="rounded-lg border border-slate-500 px-4 py-3 focus-visible:outline-2 focus-visible:outline-cyan-400" onClick={() => setExpanded(false)}>Cancelar</button>
      </div>
      <p role="alert">{state.error}</p>
    </form>}
  </div>;
}
