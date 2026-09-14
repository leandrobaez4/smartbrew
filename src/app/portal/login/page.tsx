'use client';
import { useActionState, useState } from 'react';
import { portalLogin } from './actions';
export default function Login() {
  const [invite, setInvite] = useState(false);
  const [state, action, pending] = useActionState(portalLogin, { error: '' });
  const input = 'block w-full rounded border border-slate-600 bg-slate-900 p-3 mt-1';
  return <><h1 className="text-3xl font-bold">Tu cuenta de Instagram</h1><p>Acceso por invitación. Usá tus credenciales de SmartBrew, no tu contraseña de Instagram.</p>
    <div className="flex gap-5"><button onClick={() => setInvite(false)} aria-pressed={!invite} className="underline">Iniciar sesión</button><button onClick={() => setInvite(true)} aria-pressed={invite} className="underline">Aceptar invitación</button></div>
    <form action={action} className="space-y-4">
      <label className="block">Correo<input className={input} name="email" type="email" autoComplete="email" required /></label>
      {invite && <label className="block">Código de invitación<input className={input} name="code" autoComplete="off" required minLength={64} maxLength={64} /></label>}
      <label className="block">{invite ? 'Elegí una contraseña de SmartBrew' : 'Contraseña de SmartBrew'}<input className={input} name="password" type="password" minLength={12} maxLength={128} autoComplete={invite ? 'new-password' : 'current-password'} required /></label>
      <p className="text-sm text-slate-400">Mínimo 12 caracteres. Si perdiste el acceso, contactá al administrador.</p>
      <button disabled={pending} className="rounded bg-cyan-600 px-5 py-3 font-semibold">{pending ? 'Procesando…' : invite ? 'Activar acceso' : 'Entrar'}</button><p role="alert">{state.error}</p>
    </form></>;
}
