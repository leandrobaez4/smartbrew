'use server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { logSystemEvent } from '@/lib/logger';
import { MetaApiError, requestMeta } from '@/lib/meta-api';
import { PublicationError, errorMessage, config, mediaId, refresh, publishOne, resumeInstagramPublication } from '@/lib/instagram-publish';

const prisma = new PrismaClient();
async function requireAdmin() {
  if (!await getSession()) throw new PublicationError('Iniciá sesión como administrador.');
}
export async function publishToInstagramAction(productIds: string[]) {
  let published = 0;
  try {
    await requireAdmin();
    if (!Array.isArray(productIds) || !productIds.length || productIds.length > 20 || productIds.some(id => typeof id !== 'string' || !id || id.length > 128)) throw new PublicationError('Seleccioná entre 1 y 20 productos válidos.');
    for (const id of new Set(productIds)) { await publishOne(id); published++; }
    return { success: true, published, message: `${published} producto(s) confirmado(s) por Instagram.` };
  } catch (error) { return { success: false, published, message: `${published ? `${published} producto(s) publicado(s) antes del error. ` : ''}${errorMessage(error)}` }; }
}
export async function resumeInstagramPublicationAction(productId: string, publicationId: string) {
  try {
    await requireAdmin();
    if (![productId, publicationId].every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
      throw new PublicationError('Producto o publicación inválidos.');
    }
    const externalMediaId = await resumeInstagramPublication(productId, publicationId);
    return { success: true, message: 'Instagram confirmó la publicación pendiente.', externalMediaId };
  } catch (error) {
    return { success: false, message: errorMessage(error) };
  }
}
function deletionConfig() {
  const token = process.env.INSTAGRAM_DELETE_FACEBOOK_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID;
  const version = process.env.INSTAGRAM_DELETE_GRAPH_API_VERSION || 'v26.0';
  if (!token || !accountId) throw new PublicationError('La eliminación requiere configurar el token de Facebook y el ID de Instagram para eliminación. La conexión actual no se modificó.');
  if (!/^\d+$/.test(accountId) || !/^v\d+\.0$/.test(version)) throw new PublicationError('Configuración de eliminación inválida.');
  return { token, accountId, root: `https://graph.facebook.com/${version}` };
}

// Read-only diagnostics for the Facebook Login integration, not the portal token.
export async function inspectFacebookInstagramAction(productId: string, publicationId?: string) {
  try {
    await requireAdmin();
    if (typeof productId !== 'string' || !productId || productId.length > 128 ||
        (publicationId !== undefined && (typeof publicationId !== 'string' || !publicationId || publicationId.length > 128))) {
      throw new PublicationError('Seleccioná un producto y una publicación válidos.');
    }
    const c = deletionConfig();
    let externalMediaId: string | undefined;
    if (publicationId !== undefined) {
      const records = await prisma.publication.findMany({ where: { id: publicationId, draft: { productId }, platform: 'INSTAGRAM', status: 'PUBLISHED', deletedAt: null } });
      const record = records.find(p => p.id === publicationId);
      if (!record?.externalMediaId || !/^\d+$/.test(record.externalMediaId)) throw new PublicationError('No hay una publicación activa válida para verificar.');
      externalMediaId = record.externalMediaId;
    }
    const read = () => ({ method: 'GET', headers: { Authorization: `Bearer ${c.token}` }, cache: 'no-store' as const, signal: AbortSignal.timeout(10000) });
    const account = await requestMeta<{ id?: string; username?: string }>('consultar cuenta mediante Facebook Login', `${c.root}/${c.accountId}?fields=id,username`, read());
    if (account?.id !== c.accountId || typeof account.username !== 'string' || !account.username || account.username.length > 100) throw new PublicationError('Meta no confirmó la identidad de la cuenta configurada.');
    let publication: { id: string; ownerId: string; matches: boolean } | undefined;
    if (externalMediaId) {
      const media = await requestMeta<{ id?: string; owner?: { id?: string } }>('consultar propietario de publicación', `${c.root}/${externalMediaId}?fields=id,owner`, read());
      if (media?.id !== externalMediaId || typeof media.owner?.id !== 'string' || !/^\d+$/.test(media.owner.id)) throw new PublicationError('No se pudo verificar el propietario. Esto no confirma que la publicación haya sido eliminada.');
      publication = { id: media.id, ownerId: media.owner.id, matches: media.owner.id === account.id };
    }
    return { success: true as const, account: { id: account.id, username: account.username }, publication, checkedAt: new Date().toISOString() };
  } catch (error) {
    // Do not return raw provider errors, URLs, tokens or response bodies to the browser.
    const message = error instanceof PublicationError ? error.message : error instanceof MetaApiError && error.code === 190
      ? 'El token de Facebook venció o no es válido. Revisá la configuración del servidor.'
      : 'No se pudo completar la consulta a Meta. Revisá permisos, configuración y disponibilidad. No se modificó ningún registro.';
    return { success: false as const, message };
  }
}
async function deletePublication(productId: string, publicationId: string, c: ReturnType<typeof deletionConfig>) {
  const claim = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    if (!rows.length) throw new PublicationError('Producto no encontrado.');
    const publications = await tx.publication.findMany({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null } });
    if (publications.some(p => ['UPLOADING', 'PROCESSING', 'QUEUED'].includes(p.status) || ['DELETE_IN_PROGRESS', 'DELETE_RECONCILIATION_REQUIRED'].includes(p.lastErrorCode || ''))) {
      throw new PublicationError('Hay una operación en curso o pendiente de conciliación. No se repetirá la eliminación.');
    }
    const publication = publications.find(p => p.id === publicationId && p.status === 'PUBLISHED');
    if (!publication?.externalMediaId || !/^\d+$/.test(publication.externalMediaId)) throw new PublicationError('La publicación no está disponible para eliminar. Se conserva su historial.');
    await tx.publication.update({ where: { id: publication.id }, data: { lastErrorCode: 'DELETE_IN_PROGRESS', lastErrorMessage: 'Eliminación en curso. No reintentar sin conciliar si se interrumpe.' } });
    return publication;
  });
  let deleteAttempted = false;
  let confirmed = false;
  try {
    const headers = { Authorization: `Bearer ${c.token}` };
    // Verify the Facebook credential belongs to the intended media owner before deleting.
    const media = await requestMeta<{ id?: string; owner?: { id?: string } }>('verificar propietario antes de eliminar', `${c.root}/${claim.externalMediaId}?fields=id,owner`, { headers, cache: 'no-store' });
    if (media?.id !== claim.externalMediaId || media?.owner?.id !== c.accountId) throw new PublicationError('No se pudo confirmar que la publicación pertenece a la cuenta configurada. No se solicitó eliminarla.');
    deleteAttempted = true;
    const response = await requestMeta<{ success?: boolean; deleted_id?: string }>('eliminar publicación de Instagram', `${c.root}/${claim.externalMediaId}`, { method: 'DELETE', headers, cache: 'no-store' });
    if (response?.success !== true || response.deleted_id !== claim.externalMediaId) throw new PublicationError('Meta no confirmó el ID eliminado.');
    confirmed = true;
    await prisma.publication.update({ where: { id: claim.id }, data: { deletedAt: new Date(), lastErrorCode: null, lastErrorMessage: null } });
  } catch (error) {
    const uncertain = confirmed || (deleteAttempted && !(error instanceof MetaApiError && !error.retryable));
    const message = uncertain
      ? 'Resultado de eliminación pendiente de conciliación. No se marcó como eliminada ni se borraron relaciones. No reintentes automáticamente.'
      : errorMessage(error);
    try {
      await prisma.publication.update({ where: { id: claim.id }, data: { lastErrorCode: uncertain ? 'DELETE_RECONCILIATION_REQUIRED' : 'DELETE_REJECTED', lastErrorMessage: message } });
    } catch { /* Keep the durable claim blocking after a database outage. */ }
    await logSystemEvent('ERROR', 'instagram_delete', message, { productId, publicationId: claim.id, externalMediaId: claim.externalMediaId, remoteDeletionConfirmed: confirmed });
    throw new PublicationError(message);
  } finally { refresh(productId); }
}
export async function unpublishFromInstagramAction(productIds: string[]) {
  let deleted = 0;
  try {
    await requireAdmin();
    if (!Array.isArray(productIds) || !productIds.length || productIds.length > 20 || productIds.some(id => typeof id !== 'string' || !id || id.length > 128)) throw new PublicationError('Seleccioná entre 1 y 20 productos válidos.');
    const c = deletionConfig();
    for (const productId of new Set(productIds)) {
      const publications = await prisma.publication.findMany({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null, status: 'PUBLISHED' } });
      if (!publications.length) throw new PublicationError('No hay publicaciones confirmadas para eliminar en uno de los productos.');
      for (const publication of publications) { await deletePublication(productId, publication.id, c); deleted++; }
    }
    return { success: true, deleted, message: `${deleted} publicación(es) eliminada(s) en Instagram. Historial y relaciones conservados.` };
  } catch (error) { return { success: false, deleted, message: `${deleted ? `${deleted} publicación(es) eliminada(s) antes del error. ` : ''}${errorMessage(error)}` }; }
}
export async function verifyInstagramPublicationAction(productId: string) {
  try {
    await requireAdmin();
    const c = config();
    const publications = await prisma.publication.findMany({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null, status: 'PUBLISHED' } });
    if (!publications.length) throw new PublicationError('No hay publicaciones confirmadas para verificar.');
    for (const pub of publications) {
      if (!pub.externalMediaId) throw new PublicationError('Falta el ID de Instagram; se conserva el registro para conciliación.');
      const data = await requestMeta<{ id: string }>('verificar publicación de Instagram', `${c.root}/${pub.externalMediaId}?fields=id`, {
        headers: { Authorization: `Bearer ${c.token}` }, cache: 'no-store',
      });
      if (mediaId(data) !== pub.externalMediaId) throw new PublicationError('Instagram devolvió un ID diferente al consultado.');
    }
    return { success: true, status: 'EXISTS', message: 'Instagram confirmó que las publicaciones consultadas siguen accesibles.' };
  } catch (error) { return { success: false, status: 'UNCONFIRMED', message: `${errorMessage(error)} No se modificaron datos ni se confirmó una eliminación.` }; }
}
export async function reconcileInstagramPublicationAction(productId: string, publicationId: string, reason: string, confirmed: boolean) {
  try {
    const session = await getSession();
    if (!session) throw new PublicationError('Iniciá sesión como administrador.');
    if (typeof productId !== 'string' || !productId || productId.length > 128 || typeof publicationId !== 'string' || !publicationId || publicationId.length > 128 || confirmed !== true || typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 1000) {
      throw new PublicationError('Confirmá la conciliación y explicá el motivo (entre 10 y 1000 caracteres).');
    }
    await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      if (!rows.length) throw new PublicationError('Producto no encontrado.');
      const publications = await tx.publication.findMany({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null } });
      if (publications.some(p => ['QUEUED', 'UPLOADING', 'PROCESSING'].includes(p.status) || p.lastErrorCode === 'DELETE_IN_PROGRESS')) {
        throw new PublicationError('Hay una operación en curso. No se puede retirar el registro mientras publica o elimina.');
      }
      const publication = publications.find(p => p.id === publicationId && p.status === 'PUBLISHED');
      if (!publication) throw new PublicationError('El registro cambió o ya fue retirado. Actualizá la página.');
      const retiredAt = new Date();
      // Audit and retirement commit together; retain the original IDs, status and relationships.
      await tx.systemLog.create({ data: {
        level: 'WARN', source: 'instagram_reconciliation', message: 'Retiro administrativo; NO confirma eliminación en Meta.',
        details: { productId, publicationId, externalMediaId: publication.externalMediaId, externalContainerId: publication.externalContainerId,
          previousErrorCode: publication.lastErrorCode, previousErrorMessage: publication.lastErrorMessage,
          actor: String(session.userId || session.user?.id || session.email || session.user?.email || session.sub || 'admin'),
          reason: reason.trim(), retiredAt: retiredAt.toISOString(), remoteDeletionConfirmed: false },
      } });
      await tx.publication.update({ where: { id: publicationId }, data: { deletedAt: retiredAt, lastErrorCode: 'ADMIN_RETIRED', lastErrorMessage: `Retiro administrativo (sin confirmación de Meta): ${reason.trim()}` } });
    });
    refresh(productId); revalidatePath('/admin/logs');
    return { success: true, message: 'Registro retirado administrativamente. Historial conservado; no se eliminó ni publicó nada en Instagram. Podés volver a publicar si no quedan otros registros activos.' };
  } catch (error) { return { success: false, message: errorMessage(error) }; }
}
export async function updateProductStatusAction(productId: string, status: 'CANDIDATE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
  try {
    await requireAdmin();
    await prisma.product.update({ where: { id: productId }, data: { status } }); refresh(productId);
    return { success: true };
  } catch (error) { return { success: false, message: errorMessage(error) }; }
}
