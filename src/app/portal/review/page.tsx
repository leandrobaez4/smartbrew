'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { enterMetaReview } from './actions';

export default function MetaReviewPage() {
  const [token, setToken] = useState('');
  const loaded = useRef(false);
  const [state, action, pending] = useActionState(enterMetaReview, { error: '' });
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setToken(new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
    // Keep bearer credentials out of referrers, URLs sent to the server and history.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return <>
    <h1 className="text-3xl font-bold">Acceso para revisión de Meta</h1>
    <p>Portal aislado para probar la conexión de Instagram. No otorga acceso al administrador de SmartBrew.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <button disabled={pending || !token} className="cursor-pointer rounded bg-cyan-700 px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Validando…' : 'Entrar al portal de revisión'}</button>
      <p role="alert">{state.error}</p>
    </form>
    <p className="text-sm">Si recargaste esta página, abrí nuevamente el enlace completo de la invitación. El enlace tiene vencimiento y puede ser revocado.</p>
  </>;
}
