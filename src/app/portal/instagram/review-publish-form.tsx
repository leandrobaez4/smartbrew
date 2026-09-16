'use client';
import { useActionState } from 'react';
import { publishReviewPhoto } from './publish-review';
import { REVIEW_CAPTION, REVIEW_IMAGE_PATH } from '@/lib/review-publication-content';

export default function ReviewPublishForm({ connectionId, version, username, blocked }: { connectionId: string; version: string; username: string; blocked: boolean }) {
  const [state, action, pending] = useActionState(publishReviewPhoto, { message: '' });
  return <section className="rounded-xl border border-cyan-700 p-5 space-y-3">
    <h2 className="text-xl font-semibold">Publicación de prueba para Meta</h2>
    <p>Publicará una foto real en <strong>@{username}</strong>, no en la cuenta de SmartBrew. Solo se permite un intento por acceso para evitar duplicados.</p>
    <img src={REVIEW_IMAGE_PATH} alt="Imagen de SmartBrew que se publicará como prueba" width={256} height={256} className="rounded" />
    <p className="text-sm whitespace-pre-wrap">{REVIEW_CAPTION}</p>
    <p>Antes de probar, pulsá «Volver a autorizar Instagram» y aceptá el permiso de publicación. No basta con el permiso de perfil otorgado anteriormente.</p>
    <form action={action} className="space-y-3">
      <input type="hidden" name="connectionId" value={connectionId} /><input type="hidden" name="version" value={version} />
      <label className="block"><input type="checkbox" name="confirm" value="yes" required disabled={pending || blocked} /> Confirmo publicar esta imagen y este texto en @{username}.</label>
      <button disabled={pending || blocked} className="cursor-pointer rounded bg-cyan-700 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Publicando…' : 'Publicar foto de prueba en mi Instagram'}</button>
    </form>
    <p role="status" aria-live="polite">{state.message}</p>
    <p className="text-sm">No crea productos ni automatizaciones. Si querés retirar la foto después, podés eliminarla manualmente desde Instagram.</p>
  </section>;
}
