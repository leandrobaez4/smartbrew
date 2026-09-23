import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { logSystemEvent } from '@/lib/logger';
import { MetaApiError, requestMeta } from '@/lib/meta-api';
import { getInstagramContainerStatus, InstagramContainerError, waitForInstagramContainer } from '@/lib/instagram-container';
import { mergeProductImages } from './product-gallery';
import { buildInstagramImageUrl } from './instagram-image';

const prisma = new PrismaClient();
export class PublicationError extends Error {}
export const errorMessage = (e: unknown) => e instanceof PublicationError || e instanceof MetaApiError || e instanceof InstagramContainerError
  ? e.message : 'No se pudo completar la operación. Revisá el estado antes de reintentar.';
export function config() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const base = (process.env.META_GRAPH_API_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
  const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
  const appUrl = process.env.APP_URL;
  if (!token || !accountId || !appUrl) throw new PublicationError('Faltan las credenciales de Instagram o APP_URL en el servidor.');
  if (!['https://graph.instagram.com', 'https://graph.facebook.com'].includes(base) || !/^v\d+\.0$/.test(version) || !/^\d+$/.test(accountId)) throw new PublicationError('Configuración de Instagram inválida.');
  if (new URL(appUrl).protocol !== 'https:') throw new PublicationError('APP_URL debe usar HTTPS para publicar imágenes en Instagram.');
  return { token, accountId, appUrl, imageSecret: process.env.INSTAGRAM_IMAGE_PROXY_SECRET || token, root: `${base}/${version}` };
}
export function mediaId(data: { id?: unknown; success?: unknown } | null) {
  if (!data || data.success === false || typeof data.id !== 'string' || !/^\d+$/.test(data.id)) throw new PublicationError('Instagram no confirmó un ID válido. No se considera publicado.');
  return data.id;
}
export function refresh(id: string) {
  revalidatePath('/admin/products'); revalidatePath(`/admin/products/${id}`); revalidatePath('/admin/publications');
}

type InstagramMedia = { id?: unknown; caption?: unknown; permalink?: unknown; timestamp?: unknown };

async function findPublishedMedia(c: ReturnType<typeof config>, affiliateUrl: string | null, createdAt: Date) {
  if (!affiliateUrl) return null;
  const response = await requestMeta<{ data?: InstagramMedia[] }>(
    'buscar publicación existente en Instagram',
    `${c.root}/${c.accountId}/media?fields=id,caption,permalink,timestamp&limit=50`,
    { headers: { Authorization: `Bearer ${c.token}` }, cache: 'no-store', signal: AbortSignal.timeout(10_000) },
  );
  const earliestTimestamp = createdAt.getTime() - 5 * 60_000;
  const candidates = (Array.isArray(response?.data) ? response.data : []).flatMap(media => {
    const timestamp = typeof media.timestamp === 'string' ? Date.parse(media.timestamp) : Number.NaN;
    if (typeof media.id !== 'string' || !/^\d+$/.test(media.id) || typeof media.caption !== 'string' ||
      !media.caption.includes(affiliateUrl) || !Number.isFinite(timestamp) || timestamp < earliestTimestamp) return [];
    return [{ id: media.id, permalink: typeof media.permalink === 'string' ? media.permalink : null, timestamp }];
  });
  return candidates.sort((a, b) => a.timestamp - b.timestamp)[0] || null;
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
    const images = mergeProductImages([product.primaryImageUrl], product.imageUrls);
    if (!images.length) throw new PublicationError('El producto no tiene imágenes compatibles. Los videos importados de Mercado Libre no se publican como fotos en Instagram.');
    if (images.length > 10) throw new PublicationError('El producto tiene más de 10 imágenes. El carrusel admite hasta 10 en esta integración; ajustá la galería antes de publicar. No se publicaron imágenes ni se recortó la selección.');
    let draft = await tx.contentDraft.findFirst({ where: { productId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (!draft) draft = await tx.contentDraft.create({ data: {
      productId, status: 'APPROVED', caption: `¡Mirá este producto! ${product.title}`,
      priceSnapshot: product.price, currencySnapshot: product.currencyId,
    } });
    let caption = draft.caption || `Recomendación: ${product.title}`;
    const commentPrompt = 'Comentá "Info" y te enviamos el enlace del producto por mensaje privado.';
    // Replace our previous generated invitation in saved drafts before publishing.
    caption = caption.replaceAll('💬 Comentá "Info", "Precio" o "Quiero" y te enviamos el enlace del producto por mensaje privado.', commentPrompt);
    if (!caption.includes(commentPrompt)) caption += `\n\n${commentPrompt}`;
    if (!caption.includes(product.affiliateUrl)) caption += `\n\nLink: ${product.affiliateUrl}`;
    const publication = await tx.publication.create({ data: { contentDraftId: draft.id, platform: 'INSTAGRAM', status: 'UPLOADING', attemptCount: 1 } });
    return { id: publication.id, images: images.map((image) => {
      try {
        return buildInstagramImageUrl(image, c.appUrl, c.imageSecret);
      } catch (error) {
        throw new PublicationError(error instanceof Error ? error.message : 'No se pudo preparar la imagen para Instagram.');
      }
    }), caption };
  });
  let publishAttempted = false;
  let confirmedId: string | undefined;
  try {
    // Shared preparation budget leaves time for media_publish and persistence within QStash's 90s timeout.
    const preparationDeadline = Date.now() + 60_000;
    async function createContainer(fields: Record<string, string>) {
      const remaining = preparationDeadline - Date.now();
      if (remaining <= 0) throw new InstagramContainerError('Se agotó el tiempo de preparación del carrusel. No se solicitó publicar.', true);
      return mediaId(await requestMeta<{ id: string }>('crear contenedor de Instagram', `${c.root}/${c.accountId}/media`, {
        method: 'POST', signal: AbortSignal.timeout(Math.min(20000, remaining)),
        headers: { Authorization: `Bearer ${c.token}` }, body: new URLSearchParams(fields),
      }));
    }
    let containerId: string;
    if (claim.images.length === 1) {
      containerId = await createContainer({ image_url: claim.images[0], caption: claim.caption });
    } else {
      // Await every child, preserve gallery order, and never publish a partial carousel.
      const children = await Promise.allSettled(claim.images.map(async image => {
        const id = await createContainer({ image_url: image, is_carousel_item: 'true' });
        await waitForInstagramContainer(c.root, c.token, id, preparationDeadline);
        return id;
      }));
      const failure = children.find(child => child.status === 'rejected');
      if (failure?.status === 'rejected') throw failure.reason;
      const ids = children.map(child => (child as PromiseFulfilledResult<string>).value);
      containerId = await createContainer({ media_type: 'CAROUSEL', children: ids.join(','), caption: claim.caption });
    }
    await prisma.publication.update({ where: { id: claim.id }, data: { externalContainerId: containerId, status: 'PROCESSING' } });
    await waitForInstagramContainer(c.root, c.token, containerId, preparationDeadline);
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

export async function resumeInstagramPublication(productId: string, publicationId: string) {
  const c = config();
  const claim = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    if (!rows.length) throw new PublicationError('Producto no encontrado.');
    const publication = await tx.publication.findFirst({ where: {
      id: publicationId, draft: { productId }, platform: 'INSTAGRAM', deletedAt: null,
    } });
    if (!publication || publication.status !== 'PROCESSING' || !publication.externalContainerId || !/^\d+$/.test(publication.externalContainerId)) {
      throw new PublicationError('No hay un contenedor pendiente válido para continuar. Actualizá la página.');
    }
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: { affiliateUrl: true } });
    const resumeIsFresh = publication.lastErrorCode === 'RESUME_IN_PROGRESS' &&
      Date.now() - publication.updatedAt.getTime() < 180_000;
    if (resumeIsFresh) throw new PublicationError('Este contenedor ya se está reintentando. Esperá unos minutos y actualizá la página.');
    if (!['RECONCILIATION_REQUIRED', 'RESUME_IN_PROGRESS'].includes(publication.lastErrorCode || '')) {
      throw new PublicationError('El estado de la publicación cambió. Actualizá la página antes de continuar.');
    }
    await tx.publication.update({ where: { id: publication.id }, data: {
      lastErrorCode: 'RESUME_IN_PROGRESS',
      lastErrorMessage: 'Reintentando la publicación con el contenedor existente; no se creó contenido nuevo.',
      attemptCount: { increment: 1 },
    } });
    return { id: publication.id, containerId: publication.externalContainerId, createdAt: publication.createdAt, affiliateUrl: product.affiliateUrl };
  });

  let publishAttempted = false;
  let confirmedId: string | undefined;
  let remotePublished = false;
  try {
    const deadline = Date.now() + 60_000;
    const containerStatus = await getInstagramContainerStatus(c.root, c.token, claim.containerId);
    if (containerStatus === 'PUBLISHED' || containerStatus === 'ERROR') {
      let existingMedia: Awaited<ReturnType<typeof findPublishedMedia>> = null;
      try { existingMedia = await findPublishedMedia(c, claim.affiliateUrl, claim.createdAt); }
      catch { /* Fall back to the authoritative container status below. */ }
      if (existingMedia) {
        remotePublished = true;
        await prisma.publication.update({ where: { id: claim.id }, data: {
          status: 'PUBLISHED', publishedAt: new Date(existingMedia.timestamp), externalMediaId: existingMedia.id,
          externalPermalink: existingMedia.permalink, lastErrorCode: null, lastErrorMessage: null,
        } });
        await logSystemEvent('INFO', 'instagram_publish_resume', 'Publicación existente localizada en el feed de Instagram y conciliada.', {
          productId, publicationId: claim.id, externalContainerId: claim.containerId, externalMediaId: existingMedia.id,
        });
        return existingMedia.id;
      }
    }
    if (containerStatus === 'PUBLISHED') {
      remotePublished = true;
      await prisma.publication.update({ where: { id: claim.id }, data: {
        status: 'PUBLISHED', publishedAt: new Date(),
        lastErrorCode: 'PUBLISHED_ID_MISSING',
        lastErrorMessage: 'Meta confirmó que el contenedor ya fue publicado. Falta recuperar el ID remoto para verificarlo o eliminarlo desde SmartBrew.',
      } });
      await logSystemEvent('INFO', 'instagram_publish_resume', 'Meta confirmó que el contenedor pendiente ya estaba publicado.', {
        productId, publicationId: claim.id, externalContainerId: claim.containerId,
      });
      return null;
    }
    if (containerStatus === 'ERROR' || containerStatus === 'EXPIRED') {
      throw new InstagramContainerError(`Instagram informó ${containerStatus} para el contenedor. No se solicitó publicar.`, false);
    }
    if (containerStatus === 'IN_PROGRESS') await waitForInstagramContainer(c.root, c.token, claim.containerId, deadline);
    publishAttempted = true;
    confirmedId = mediaId(await requestMeta<{ id: string }>('reintentar publicación del contenedor de Instagram', `${c.root}/${c.accountId}/media_publish`, {
      method: 'POST', signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${c.token}` },
      body: new URLSearchParams({ creation_id: claim.containerId }),
    }));
    await prisma.publication.update({ where: { id: claim.id }, data: {
      status: 'PUBLISHED', publishedAt: new Date(), externalMediaId: confirmedId,
      lastErrorCode: null, lastErrorMessage: null,
    } });
    await logSystemEvent('INFO', 'instagram_publish_resume', 'Publicación pendiente confirmada usando el contenedor existente.', {
      productId, publicationId: claim.id, externalContainerId: claim.containerId, externalMediaId: confirmedId,
    });
    return confirmedId;
  } catch (error) {
    const containerPending = error instanceof InstagramContainerError && error.pending;
    const mediaNotReady = error instanceof MetaApiError && error.code === 9007 && error.subcode === 2207027;
    const retryablePublishFailure = publishAttempted && error instanceof MetaApiError && error.retryable;
    const uncertain = containerPending || mediaNotReady || retryablePublishFailure || Boolean(confirmedId) || remotePublished;
    const message = mediaNotReady
      ? 'Meta todavía no permite publicar este contenedor (9007/2207027). Se conserva para volver a intentarlo sin duplicar imágenes.'
      : remotePublished
        ? 'Meta confirmó que el contenedor ya fue publicado, pero SmartBrew no pudo guardar la conciliación. No vuelvas a publicar.'
      : uncertain
        ? 'El contenedor existente sigue pendiente. No se creó otro; podés volver a intentar cuando Meta se recupere.'
        : errorMessage(error);
    try {
      await prisma.publication.update({ where: { id: claim.id }, data: {
        status: uncertain ? 'PROCESSING' : 'FAILED',
        lastErrorCode: uncertain ? 'RECONCILIATION_REQUIRED' : 'META_REJECTED',
        lastErrorMessage: message,
        ...(confirmedId ? { externalMediaId: confirmedId } : {}),
      } });
    } catch { /* Keep the durable claim blocking after a database outage. */ }
    await logSystemEvent('ERROR', 'instagram_publish_resume', message, {
      productId, publicationId: claim.id, externalContainerId: claim.containerId, externalMediaId: confirmedId,
    });
    throw new PublicationError(message);
  } finally { refresh(productId); }
}
