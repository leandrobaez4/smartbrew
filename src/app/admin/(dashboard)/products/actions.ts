'use server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { logSystemEvent } from '@/lib/logger';
import { MetaApiError, requestMeta } from '@/lib/meta-api';
import { InstagramContainerError, waitForInstagramContainer } from '@/lib/instagram-container';

const prisma = new PrismaClient();
class PublicationError extends Error {}
const errorMessage = (e: unknown) => e instanceof PublicationError || e instanceof MetaApiError || e instanceof InstagramContainerError
  ? e.message : 'No se pudo completar la operación. Revisá el estado antes de reintentar.';
async function requireAdmin() {
  if (!await getSession()) throw new PublicationError('Iniciá sesión como administrador.');
}
function config() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const base = (process.env.META_GRAPH_API_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
  if (!token || !accountId) throw new PublicationError('Faltan las credenciales de Instagram del servidor.');
  if (!['https://graph.instagram.com', 'https://graph.facebook.com'].includes(base) || !/^v\d+\.0$/.test(version) || !/^\d+$/.test(accountId)) throw new PublicationError('Configuración de Instagram inválida.');
  return { token, accountId, root: `${base}/${version}` };
}
function mediaId(data: { id?: unknown; success?: unknown } | null) {
  if (!data || data.success === false || typeof data.id !== 'string' || !/^\d+$/.test(data.id)) throw new PublicationError('Instagram no confirmó un ID válido. No se considera publicado.');
  return data.id;
}
function refresh(id: string) {
  revalidatePath('/admin/products'); revalidatePath(`/admin/products/${id}`); revalidatePath('/admin/publications');
}
async function publishOne(productId: string) {
  const c = config();
  // Serialize durable claims across Vercel instances, without holding a lock during HTTP calls.
  const claim = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    if (!rows.length) throw new PublicationError('Producto no encontrado.');
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const active = await tx.publication.findFirst({ where: {
      draft: { productId }, platform: 'INSTAGRAM', deletedAt: null,
      status: { in: ['PUBLISHED', 'QUEUED', 'UPLOADING', 'PROCESSING'] },
    } });
    if (active) throw new PublicationError(active.status === 'PUBLISHED'
      ? 'Ya existe una publicación registrada. No se envió otra a Instagram. Si la borraste manualmente, su eliminación debe conciliarse sin perder el historial.'
      : 'Hay una publicación en curso o pendiente de conciliación. No se reintentará para evitar duplicados.');
    if (!product.affiliateUrl || !product.primaryImageUrl) throw new PublicationError('El producto necesita imagen y enlace de afiliado.');
    let draft = await tx.contentDraft.findFirst({ where: { productId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (!draft) draft = await tx.contentDraft.create({ data: {
      productId, status: 'APPROVED', caption: `¡Mirá este producto! ${product.title}`,
      priceSnapshot: product.price, currencySnapshot: product.currencyId,
    } });
    let caption = draft.caption || `Recomendación: ${product.title}`;
    const commentPrompt = '💬 Comentá "Info", "Precio" o "Quiero" y te enviamos el enlace del producto por mensaje privado.';
    if (!caption.includes(commentPrompt)) caption += `\n\n${commentPrompt}`;
    if (!caption.includes(product.affiliateUrl)) caption += `\n\nLink: ${product.affiliateUrl}`;
    const publication = await tx.publication.create({ data: { contentDraftId: draft.id, platform: 'INSTAGRAM', status: 'UPLOADING', attemptCount: 1 } });
    return { id: publication.id, image: product.primaryImageUrl, caption };
  });
  let publishAttempted = false;
  let confirmedId: string | undefined;
  try {
    const container = await requestMeta<{ id: string }>('crear contenedor de Instagram', `${c.root}/${c.accountId}/media`, {
      method: 'POST', headers: { Authorization: `Bearer ${c.token}` }, body: new URLSearchParams({ image_url: claim.image, caption: claim.caption }),
    });
    const containerId = mediaId(container);
    await prisma.publication.update({ where: { id: claim.id }, data: { externalContainerId: containerId, status: 'PROCESSING' } });
    await waitForInstagramContainer(c.root, c.token, containerId);
    publishAttempted = true;
    const response = await requestMeta<{ id: string }>('publicar contenedor de Instagram', `${c.root}/${c.accountId}/media_publish`, {
      method: 'POST', headers: { Authorization: `Bearer ${c.token}` }, body: new URLSearchParams({ creation_id: containerId }),
    });
    confirmedId = mediaId(response);
    await prisma.publication.update({ where: { id: claim.id }, data: {
      status: 'PUBLISHED', publishedAt: new Date(), externalMediaId: confirmedId, lastErrorCode: null, lastErrorMessage: null,
    } });
    await logSystemEvent('INFO', 'instagram_publish', 'Publicación confirmada por Instagram y guardada.', { productId, publicationId: claim.id, externalMediaId: confirmedId });
  } catch (error) {
    // Never retry an ambiguous external side effect automatically.
    const containerPending = error instanceof InstagramContainerError && error.pending;
    const mediaNotReady = error instanceof MetaApiError && error.code === 9007 && error.subcode === 2207027;
    const uncertain = containerPending || mediaNotReady || Boolean(confirmedId) || (publishAttempted && !(error instanceof MetaApiError && !error.retryable));
    const message = containerPending ? errorMessage(error) : mediaNotReady
      ? 'Meta aún no permite publicar el contenedor (9007/2207027). Se conserva el mismo intento para revisión; no vuelvas a crear otra publicación.'
      : uncertain ? 'Resultado de publicación incierto. Requiere conciliación; no vuelvas a publicar para evitar duplicados.' : errorMessage(error);
    try {
      await prisma.publication.update({ where: { id: claim.id }, data: {
        status: uncertain ? 'PROCESSING' : 'FAILED', lastErrorCode: uncertain ? 'RECONCILIATION_REQUIRED' : 'META_REJECTED', lastErrorMessage: message,
        ...(confirmedId ? { externalMediaId: confirmedId } : {}),
      } });
    } catch { /* The original durable claim remains blocking after a DB outage. */ }
    await logSystemEvent('ERROR', 'instagram_publish', message, { productId, publicationId: claim.id, externalMediaId: confirmedId });
    throw new PublicationError(message);
  } finally { refresh(productId); }
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
