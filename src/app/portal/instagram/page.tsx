import { portalDb, requirePortal } from '@/lib/portal';
import { instagramLoginConfig } from '@/lib/instagram-login';
import { connectInstagram, disconnectInstagram, logoutPortal, refreshProfile } from './actions';
export const dynamic = 'force-dynamic';
const messages: Record<string, string> = {
  connected: 'Cuenta conectada. Perfil obtenido de la API de Instagram.',
  refreshed: 'Información actualizada desde Instagram.',
  disconnected: 'Conexión local y token eliminados. Podés retirar la autorización también desde Instagram → Apps y sitios web.',
  configuration: 'El administrador debe completar la configuración de Instagram Login.',
  denied: 'No autorizaste la conexión. Podés intentarlo de nuevo.',
  failed: 'No se pudo conectar. Revisá los permisos, la configuración de Meta o si la cuenta ya está vinculada a otro acceso.',
  invalid_state: 'La autorización venció o no corresponde a esta sesión. Iniciá la conexión nuevamente.',
  reserved: 'Esta cuenta está reservada para la automatización de SmartBrew. Usá otra cuenta profesional para este portal de prueba.',
  reconnect: 'No pudimos actualizar el perfil. Volvé a autorizar la cuenta.',
};
export default async function InstagramPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await requirePortal();
  const connection = await portalDb.instagramConnection.findUnique({ where: { memberId: session.memberId }, select: { username: true, instagramId: true, expiresAt: true, updatedAt: true } });
  const { status } = await searchParams;
  let configured = true;
  try { instagramLoginConfig(); } catch { configured = false; }
  const button = 'rounded bg-cyan-700 px-4 py-3 text-white disabled:opacity-50';
  return <><h1 className="text-3xl font-bold">Conectar Instagram</h1><p>{session.member.email}</p>
    <p>Conectá una cuenta profesional para consultar su usuario e identificador. Esta prueba solicita únicamente instagram_business_basic; no publica ni envía mensajes.</p>
    {status && messages[status] && <p role="status" className="rounded border border-cyan-700 p-4">{messages[status]}</p>}
    {!configured && <p role="alert">Conexión no disponible: falta configuración del servidor.</p>}
    {connection && <section className="border border-slate-700 rounded-xl p-5 space-y-3"><h2 className="text-xl font-semibold">@{connection.username}</h2><dl><dt>ID de Instagram</dt><dd className="break-all">{connection.instagramId}</dd><dt>Perfil consultado</dt><dd>{connection.updatedAt.toISOString()}</dd><dt>Autorización válida hasta</dt><dd>{connection.expiresAt.toISOString()}</dd></dl>
      {connection.expiresAt <= new Date() && <p>Autorización vencida: reconectá tu cuenta.</p>}
      <form action={refreshProfile}><button className={button}>Actualizar perfil desde Instagram</button></form>
      <form action={disconnectInstagram}><button type="submit" className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-red-700 bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:border-red-800 hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">Desconectar y eliminar token guardado</button></form>
    </section>}
    <form action={connectInstagram}><button disabled={!configured} className={button}>{connection ? 'Volver a autorizar Instagram' : 'Conectar Instagram'}</button></form>
    <p className="text-sm text-slate-400">La contraseña se ingresa solo en Instagram. SmartBrew guarda el token cifrado, nunca lo muestra y no modifica la cuenta del bot de producción.</p>
    <form action={logoutPortal}><button className="underline">Cerrar sesión</button></form></>;
}
