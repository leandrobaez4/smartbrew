'use server';
import { revalidatePath } from 'next/cache';
import { portalDb, requirePortal } from '@/lib/portal';
import { openToken } from '@/lib/portal-crypto';
import { instagramLoginConfig, instagramProfile } from '@/lib/instagram-login';
import { MetaApiError, requestMeta } from '@/lib/meta-api';
import { waitForInstagramContainer } from '@/lib/instagram-container';
import { REVIEW_CAPTION, REVIEW_IMAGE_PATH } from '@/lib/review-publication-content';

const reserved = (id: string, username: string) => [process.env.INSTAGRAM_ACCOUNT_ID, process.env.INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID].includes(id) || username.toLowerCase() === 'smartbrewmrl';
function validId(value: unknown): value is string { return typeof value === 'string' && /^\d+$/.test(value); }

export async function publishReviewPhoto(_state: { message: string }, form: FormData) {
  const session = await requirePortal();
  if (!session.member.reviewExpiresAt || !session.member.reviewTokenHash || session.member.reviewExpiresAt <= new Date()) return { message: 'Esta función es exclusiva del acceso temporal de revisión de Meta.' };
  if (form.get('confirm') !== 'yes') return { message: 'Confirmá que querés publicar esta foto realmente en tu cuenta de Instagram.' };
  const connectionId = String(form.get('connectionId') || '');
  const version = String(form.get('version') || '');
  if (!connectionId || connectionId.length > 128 || !version || version.length > 40) return { message: 'Recargá la página para confirmar la cuenta actual.' };
  let claimed = false;
  let publishAttempted = false;
  let confirmedId: string | undefined;
  try {
    const c = instagramLoginConfig();
    const connection = await portalDb.$transaction(async tx => {
      // Same member lock as revocation/disconnection. The unique claim also
      // survives timeouts, reconnects and concurrent browser submissions.
      const active = await tx.portalMember.updateMany({ where: { id: session.memberId, disabled: false, reviewTokenHash: { not: null }, reviewExpiresAt: { gt: new Date() } }, data: { disabled: false } });
      if (!active.count) throw Error('Inactive review');
      const connection = await tx.instagramConnection.findUnique({ where: { memberId: session.memberId } });
      if (!connection || connection.id !== connectionId || connection.updatedAt.toISOString() !== version || connection.expiresAt <= new Date() || !validId(connection.instagramId) || reserved(connection.instagramId, connection.username)) throw Error('Invalid connection');
      await tx.reviewPublication.create({ data: { memberId: session.memberId, instagramId: connection.instagramId } });
      return connection;
    });
    claimed = true;
    const token = openToken(connection.encryptedToken, session.memberId);
    const profile = await instagramProfile(token);
    if (profile.user_id !== connection.instagramId || reserved(profile.user_id, profile.username)) throw Error('Account mismatch');
    const root = `https://graph.instagram.com/${c.version}`;
    const init = () => ({ method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' as const, signal: AbortSignal.timeout(15000) });
    const container = await requestMeta<{ id?: string }>('crear foto de revisión', `${root}/${connection.instagramId}/media`, {
      ...init(), body: new URLSearchParams({ image_url: `${c.origin}${REVIEW_IMAGE_PATH}`, caption: REVIEW_CAPTION }),
    });
    if (!validId(container?.id)) throw Error('Invalid container');
    await portalDb.reviewPublication.update({ where: { memberId: session.memberId }, data: { containerId: container.id } });
    await waitForInstagramContainer(root, token, container.id);
    // Re-check access and the exact saved connection after the external wait.
    const currentSession = await requirePortal();
    const current = await portalDb.instagramConnection.findUnique({ where: { memberId: session.memberId } });
    if (currentSession.memberId !== session.memberId || !current || current.id !== connection.id || current.encryptedToken !== connection.encryptedToken) throw Error('Connection changed');
    publishAttempted = true;
    const published = await requestMeta<{ id?: string }>('publicar foto de revisión', `${root}/${connection.instagramId}/media_publish`, { ...init(), body: new URLSearchParams({ creation_id: container.id }) });
    if (!validId(published?.id)) throw Error('Invalid media');
    confirmedId = published.id;
    await portalDb.reviewPublication.update({ where: { memberId: session.memberId }, data: { status: 'PUBLISHED', mediaId: published.id, message: 'Publicación confirmada por Instagram.' } });
    revalidatePath('/portal/instagram');
    return { message: `Publicación confirmada. ID de Instagram: ${published.id}. Podés verla en tu perfil de Instagram.` };
  } catch (error) {
    const message = !claimed ? 'No se inició otra publicación. Revisá la conexión y el resultado del intento anterior; solo se permite un intento por acceso de revisión.'
      : publishAttempted ? 'No se pudo confirmar el resultado final. Revisá tu perfil y contactá al administrador; no se reintentará para evitar duplicados.'
      : error instanceof MetaApiError && error.code === 190 ? 'El token de Instagram no es válido. Volvé a autorizar y solicitá un nuevo acceso de prueba.'
      : 'La prueba no se completó; puede faltar autorizar publicación o el contenedor no estar listo. No se solicitó publicar. Contactá al administrador para revisar el intento.';
    if (claimed) {
      try { await portalDb.reviewPublication.update({ where: { memberId: session.memberId }, data: { status: publishAttempted ? 'UNCERTAIN' : 'FAILED', message, ...(confirmedId ? { mediaId: confirmedId } : {}) } }); } catch { /* Keep durable claim blocking. */ }
    }
    revalidatePath('/portal/instagram');
    return { message };
  }
}
