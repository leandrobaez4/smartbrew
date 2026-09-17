import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { logSystemEvent } from '@/lib/logger';
import { MetaApiError, requestMeta } from '@/lib/meta-api';
import { InstagramContainerError, waitForInstagramContainer } from '@/lib/instagram-container';

const prisma = new PrismaClient();
export class PublicationError extends Error {}
export const errorMessage = (e: unknown) => e instanceof PublicationError || e instanceof MetaApiError || e instanceof InstagramContainerError
  ? e.message : 'No se pudo completar la operación. Revisá el estado antes de reintentar.';
export function config() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const base = (process.env.META_GRAPH_API_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
  if (!token || !accountId) throw new PublicationError('Faltan las credenciales de Instagram del servidor.');
  if (!['https://graph.instagram.com', 'https://graph.facebook.com'].includes(base) || !/^v\d+\.0$/.test(version) || !/^\d+$/.test(accountId)) throw new PublicationError('Configuración de Instagram inválida.');
  return { token, accountId, root: `${base}/${version}` };
}
export function mediaId(data: { id?: unknown; success?: unknown } | null) {
  if (!data || data.success === false || typeof data.id !== 'string' || !/^\d+$/.test(data.id)) throw new PublicationError('Instagram no confirmó un ID válido. No se considera publicado.');
  return data.id;
}
export function refresh(id: string) {
  revalidatePath('/admin/products'); revalidatePath(`/admin/products/${id}`); revalidatePath('/admin/publications');
}
export async function publishOne(productId: string) {
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
      method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${c.token}` }, body: new URLSearchParams({ image_url: claim.image, caption: claim.caption }),
    });
    const containerId = mediaId(container);
    await prisma.publication.update({ where: { id: claim.id }, data: { externalContainerId: containerId, status: 'PROCESSING' } });
    await waitForInstagramContainer(c.root, c.token, containerId);
    publishAttempted = true;
    const response = await requestMeta<{ id: string }>('publicar contenedor de Instagram', `${c.root}/${c.accountId}/media_publish`, {
      method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${c.token}` }, body: new URLSearchParams({ creation_id: containerId }),
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
