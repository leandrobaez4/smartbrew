import { portalDb, requirePortal } from '@/lib/portal';
import { instagramLoginConfig } from '@/lib/instagram-login';
import { connectInstagram, logoutPortal, refreshProfile } from './actions';
import DisconnectForm from './disconnect-form';
import ReviewPublishForm from './review-publish-form';
export const dynamic = 'force-dynamic';
const messages: Record<string, string> = {
  connected: 'Cuenta conectada. Perfil obtenido de la API de Instagram.',
  refreshed: 'Información actualizada desde Instagram.',
  disconnected: 'Conexión local y token eliminados. Para retirar también la autorización en Instagram, seguí los pasos indicados más abajo.',
  configuration: 'El administrador debe completar la configuración de Instagram Login.',
  denied: 'No autorizaste la conexión. Podés intentarlo de nuevo.',
  failed: 'No se pudo conectar. Revisá los permisos, la configuración de Meta o si la cuenta ya está vinculada a otro acceso.',
  invalid_state: 'La autorización venció o no corresponde a esta sesión. Iniciá la conexión nuevamente.',
  reserved: 'Esta cuenta está reservada para la automatización de SmartBrew. Usá otra cuenta profesional para este portal de prueba.',
  reconnect: 'No pudimos actualizar el perfil. Volvé a autorizar la cuenta.',
};
export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requirePortal();
  const review = Boolean(session.member.reviewExpiresAt);
  const attempt = review ? await portalDb.reviewPublication.findUnique({ where: { memberId: session.memberId } }) : null;
  const connection = await portalDb.instagramConnection.findUnique({ where: { memberId: session.memberId }, select: { id: true, username: true, instagramId: true, expiresAt: true, updatedAt: true } });
  const { status } = await searchParams;
  let configured = true;
  try { instagramLoginConfig(); } catch { configured = false; }
  const button = 'rounded bg-cyan-700 px-4 py-3 text-white disabled:opacity-50';
  return <><h1 className="text-3xl font-bold">Conectar Instagram</h1><p>{session.member.reviewExpiresAt ? `Cuenta de revisión de Meta · Acceso hasta ${session.member.reviewExpiresAt.toISOString()}` : session.member.email}</p>
    <p>{review ? 'Conectá una cuenta profesional propia para consultar su perfil y publicar una foto de prueba con confirmación explícita. Se solicitan instagram_business_basic e instagram_business_content_publish. No se envían mensajes.' : 'Conectá una cuenta profesional para consultar su usuario e identificador. Esta prueba solicita únicamente instagram_business_basic; no publica ni envía mensajes.'}</p>
    {status && messages[status] && <p role="status" className="rounded border border-cyan-700 p-4">{messages[status]}</p>}
    {!configured && <p role="alert">Conexión no disponible: falta configuración del servidor.</p>}
    {connection && <section className="border border-slate-700 rounded-xl p-5 space-y-3"><h2 className="text-xl font-semibold">@{connection.username}</h2><dl><dt>ID de Instagram</dt><dd className="break-all">{connection.instagramId}</dd><dt>Perfil consultado</dt><dd>{connection.updatedAt.toISOString()}</dd><dt>Autorización válida hasta</dt><dd>{connection.expiresAt.toISOString()}</dd></dl>
      {connection.expiresAt <= new Date() && <p>Autorización vencida: reconectá tu cuenta.</p>}
      <form action={refreshProfile}><button className={button}>Actualizar perfil desde Instagram</button></form>
      <DisconnectForm key={`${connection.id}:${connection.updatedAt.toISOString()}`} connectionId={connection.id} username={connection.username} version={connection.updatedAt.toISOString()} />
    </section>}
    <form action={connectInstagram}><button disabled={!configured} className={button}>{connection ? 'Volver a autorizar Instagram' : 'Conectar Instagram'}</button></form>
    {review && connection && <ReviewPublishForm key={`${connection.id}:${connection.updatedAt.toISOString()}`} connectionId={connection.id} version={connection.updatedAt.toISOString()} username={connection.username} blocked={Boolean(attempt) || connection.expiresAt <= new Date()} />}
    {attempt && <section className="rounded border p-4 space-y-2"><h2>Resultado de la prueba de publicación</h2><p>Estado: {attempt.status}</p><p>Cuenta de Instagram: {attempt.instagramId}</p>{attempt.mediaId && <p>ID publicado: {attempt.mediaId}</p>}<p>{attempt.message || 'Intento en curso o pendiente de revisión. No vuelvas a enviarlo.'}</p></section>}
    <p className="text-sm text-slate-400">La contraseña se ingresa solo en Instagram. SmartBrew guarda el token cifrado, nunca lo muestra y no modifica la cuenta del bot de producción.</p>
    <section aria-labelledby="instagram-remove-access" className="rounded-xl border border-slate-700 p-5 space-y-3 text-sm">
      <h2 id="instagram-remove-access" className="text-lg font-semibold">Cómo quitar también la autorización desde Instagram</h2>
      <p>Desconectar en SmartBrew elimina la conexión y el token guardado en este portal. Para retirar además el permiso que Instagram conserva para Afiliados-IG:</p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Abrí Instagram y seleccioná el perfil de la cuenta que querés desconectar.</li>
        <li>Desde tu perfil, abrí el menú ☰ y buscá Configuración y actividad. En una computadora, entrá en Más → Configuración.</li>
        <li>Entrá en Permisos del sitio web → Apps y sitios web.</li>
        <li>En Activas, buscá Afiliados-IG, seleccioná Eliminar y confirmá.</li>
      </ol>
      <p className="text-slate-400">Los nombres de los menús pueden variar según la versión de Instagram. Esto no elimina tu cuenta de Instagram ni tu usuario de SmartBrew. Para volver a usar la conexión, tendrás que autorizarla nuevamente.</p>
      <a href="https://help.instagram.com/1144624522593085" target="_blank" rel="noopener noreferrer" className="inline-block underline text-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400">Ver ayuda de Instagram (abre en otra pestaña)</a>
    </section>
    <form action={logoutPortal}><button className="underline">Cerrar sesión</button></form></>;
}
