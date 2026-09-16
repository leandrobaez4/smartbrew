'use client';
import { useActionState } from 'react';
import { createMetaReviewAccess } from './actions';

export default function MetaReviewForm() {
  const [state, action, pending] = useActionState(createMetaReviewAccess, { message: '' });
  const link = state.token && typeof window !== 'undefined' ? `${window.location.origin}/portal/review#token=${state.token}` : '';
  return <section className="border rounded p-4 space-y-3">
    <h2 className="text-xl font-semibold">Acceso exclusivo para revisión de Meta</h2>
    <p>Enlace reutilizable por 60 días para conectar una cuenta profesional propia y publicar una foto de prueba con confirmación. No permite entrar al administrador ni usar la cuenta de producción de SmartBrew. Cualquiera con el enlace puede usarlo: compartilo únicamente en el formulario privado de revisión de Meta.</p>
    <form action={action} className="space-y-3">
      <label className="block"><input type="checkbox" name="confirmed" required disabled={pending} /> Crear una cuenta aislada para la revisión de Meta.</label>
      <button className="cursor-pointer rounded bg-blue-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={pending}>{pending ? 'Creando…' : 'Crear enlace de revisión (60 días)'}</button>
    </form>
    <p role="status">{state.message}</p>
    {link && <div className="space-y-2">
      <label className="block">Enlace privado (copialo completo)<textarea readOnly value={link} className="w-full rounded border p-2 bg-white text-black" rows={3} onFocus={e => e.currentTarget.select()} /></label>
      <p>Vence: {new Date(state.expiresAt!).toLocaleString()}. Podés revocarlo en «Todos los accesos». No se envía por correo.</p>
    </div>}
  </section>;
}
