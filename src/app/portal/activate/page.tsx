'use client';
import { useActionState, useEffect, useState } from 'react';
import { activateInvitation, inspectInvitation } from './actions';

export default function ActivateInvitation() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'failed'>('checking');
  const [state, action, pending] = useActionState(activateInvitation, { error: '' });
  useEffect(() => {
    let active = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    setToken(value);
    inspectInvitation(value).then(valid => { if (active) setStatus(valid ? 'valid' : 'invalid'); })
      .catch(() => { if (active) setStatus('failed'); });
    return () => { active = false; };
  }, []);
  return <>
    <h1 className="text-3xl font-bold">Activá tu acceso a SmartBrew</h1>
    {status === 'checking' && <p role="status">Validando invitación…</p>}
    {status === 'invalid' && <p role="alert">La invitación no es válida, venció o ya fue utilizada. Pedí un enlace nuevo al administrador.</p>}
    {status === 'failed' && <p role="alert">No pudimos validar la invitación. Recargá esta página para intentar nuevamente.</p>}
    {status === 'valid' && <form action={action} className="space-y-4">
      <p>Tu invitación es válida. Solo tenés que elegir una contraseña nueva de SmartBrew; no uses tu contraseña de Instagram.</p>
      <input type="hidden" name="token" value={token} />
      <label className="block">Nueva contraseña de SmartBrew<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="block w-full rounded border border-slate-600 bg-slate-900 p-3 mt-1" /></label>
      <p className="text-sm">Entre 12 y 128 caracteres. Después podrás conectar Instagram.</p>
      <button disabled={pending} className="rounded bg-cyan-600 px-5 py-3 font-semibold">{pending ? 'Activando…' : 'Activar acceso'}</button>
      <p role="alert">{state.error}</p>
    </form>}
    <a href="/portal/login" className="underline">Ya tengo acceso: iniciar sesión</a>
  </>;
}
