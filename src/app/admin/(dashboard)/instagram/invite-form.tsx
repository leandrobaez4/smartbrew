'use client';
import { useActionState } from 'react';
import { inviteMember } from './actions';
export default function InviteForm() {
  const [state, action, pending] = useActionState(inviteMember, { message: '' });
  return <form action={action} className="space-y-3 rounded-xl border p-5">
    <label className="block">Correo del invitado<input required type="email" name="email" className="block rounded border p-2 bg-transparent w-full" /></label>
    <button disabled={pending} className="rounded bg-cyan-700 text-white px-4 py-2">{pending ? 'Creando…' : 'Crear invitación'}</button>
    <p role="status">{state.message}</p>
    {state.code && <div><p>Activar en /portal/login, pestaña «Aceptar invitación»:</p><code className="break-all select-all">{state.code}</code></div>}
  </form>;
}
