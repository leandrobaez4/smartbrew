import { createHash } from 'node:crypto';
import { Client } from '@upstash/qstash';
import { portalDb as db } from './portal';
import { parseAffiliateImport } from './affiliate-import-input';
import { mergeProductImages } from './product-gallery';

export async function saveOrQueueAffiliate(raw: unknown, expectedLink: string | null) {
  const data = parseAffiliateImport(raw);
  const existing = await db.product.findUnique({ where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId } } });
  if (existing) {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${existing.id} FOR UPDATE`;
      const current = await tx.product.findUniqueOrThrow({ where: { id: existing.id } });
      const update = await tx.product.updateMany({ where: { id: existing.id, OR: [{ affiliateUrl: data.affiliateUrl }, ...(expectedLink === null ? [{ affiliateUrl: null }, { affiliateUrl: '' }] : [{ affiliateUrl: expectedLink }])] }, data: { affiliateUrl: data.affiliateUrl, imageUrls: mergeProductImages(current.imageUrls, data.images) } });
      if (!update.count) throw Error('El enlace cambió o requiere confirmación. Recargá la pantalla antes de reemplazarlo.');
    });
    return { message: 'Enlace y galería guardados.', productId: existing.id };
  }
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY || !process.env.APP_URL) throw Error('Falta configurar QStash y APP_URL en el servidor.');
  const destination = new URL('/api/queue/affiliate-import', process.env.APP_URL);
  if (destination.protocol !== 'https:') throw Error('APP_URL debe usar HTTPS.');
  const id = 'affiliate_' + createHash('sha256').update(`${data.externalId}:${data.affiliateUrl}`).digest('hex');
  const job = await db.jobExecution.upsert({ where: { id }, update: {}, create: { id, jobName: 'affiliate_import', entityType: 'product', entityId: data.externalId, status: 'STARTED', inputJson: data } });
  if (job.status === 'SUCCEEDED') return { message: 'Esta importación ya fue completada.', jobId: id };
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  try {
    await client.publishJSON({ url: destination.href, body: { jobId: id }, retries: 3, deduplicationId: id,
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : undefined });
  } catch {
    throw Error('No se pudo confirmar el envío a QStash. Podés volver a confirmar: el trabajo es idempotente.');
  }
  return { message: 'Importación enviada a QStash (todavía no completada). Actualizá esta página para consultar el estado.', jobId: id };
}

export async function processAffiliateImport(jobId: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "JobExecution" WHERE id = ${jobId} FOR UPDATE`;
    const job = await tx.jobExecution.findUnique({ where: { id: jobId } });
    if (!job || job.jobName !== 'affiliate_import') throw Error('Trabajo inexistente.');
    if (job.status === 'SUCCEEDED') return;
    const data = parseAffiliateImport(job.inputJson);
    const product = await tx.product.upsert({
      where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId } },
      update: {},
      create: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId, title: data.title, originalPermalink: data.url, primaryImageUrl: data.image || data.images[0] || null, imageUrls: data.images, affiliateUrl: data.affiliateUrl, status: 'CANDIDATE', selectionReasons: ['Importado desde extensión; precio y disponibilidad pendientes de verificar.'] },
    });
    // Atomic guard against another import or manual link edit. Never overwrite silently.
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${product.id} FOR UPDATE`;
    const current = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    const saved = await tx.product.updateMany({ where: { id: product.id, OR: [{ affiliateUrl: null }, { affiliateUrl: '' }, { affiliateUrl: data.affiliateUrl }] }, data: { affiliateUrl: data.affiliateUrl, imageUrls: mergeProductImages(current.imageUrls, data.images) } });
    await tx.jobExecution.update({ where: { id: jobId }, data: {
      status: saved.count ? 'SUCCEEDED' : 'FAILED', finishedAt: new Date(),
      errorMessage: saved.count ? null : 'El producto ya tiene otro enlace. Confirmá el reemplazo desde el admin.',
      outputJson: { productId: product.id },
    } });
  });
}
