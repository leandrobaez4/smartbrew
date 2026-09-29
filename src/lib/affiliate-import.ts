import { randomBytes } from 'node:crypto';
import { Client } from '@upstash/qstash';
import { portalDb as db } from './portal';
import { parseAffiliateImport } from './affiliate-import-input';
import { mergeProductImages } from './product-gallery';
import { createProductSlug } from './product-slug';
import { generateAndSaveProductEditorial } from './product-editorial';

export async function saveOrQueueAffiliate(raw: unknown, expectedLink: string | null) {
  const data = parseAffiliateImport(raw);
  const existing = await db.product.findUnique({ where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId } } });
  if (existing?.affiliateUrl && existing.affiliateUrl !== data.affiliateUrl && expectedLink !== existing.affiliateUrl) {
    throw Error('El enlace cambió o requiere confirmación. Recargá la pantalla antes de reemplazarlo.');
  }
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY || !process.env.APP_URL) throw Error('Falta configurar QStash y APP_URL en el servidor.');
  const destination = new URL('/api/queue/affiliate-import', process.env.APP_URL);
  if (destination.protocol !== 'https:') throw Error('APP_URL debe usar HTTPS.');
  const id = `affiliate_${randomBytes(32).toString('hex')}`;
  await db.jobExecution.create({ data: {
    id,
    jobName: 'affiliate_import',
    entityType: 'product',
    entityId: data.externalId,
    status: 'STARTED',
    inputJson: { ...data, expectedLink },
    maxAttempts: 4,
  } });
  const client = new Client({ token: process.env.QSTASH_TOKEN });
  try {
    await client.publishJSON({ url: destination.href, body: { jobId: id }, retries: 3, deduplicationId: id,
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : undefined });
  } catch {
    await db.jobExecution.update({
      where: { id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: 'No se pudo enviar el trabajo a QStash.' },
    }).catch(() => undefined);
    throw Error('No se pudo confirmar el envío a QStash. Podés volver a confirmar: el trabajo es idempotente.');
  }
  return { message: 'Importación enviada a QStash (todavía no completada). Actualizá esta página para consultar el estado.', jobId: id };
}

export async function processAffiliateImport(jobId: string) {
  const productId = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "JobExecution" WHERE id = ${jobId} FOR UPDATE`;
    const job = await tx.jobExecution.findUnique({ where: { id: jobId } });
    if (!job || job.jobName !== 'affiliate_import') throw Error('Trabajo inexistente.');
    if (job.status === 'SUCCEEDED') return job.outputJson && typeof job.outputJson === 'object' && 'productId' in job.outputJson
      ? String(job.outputJson.productId)
      : null;
    const raw = job.inputJson && typeof job.inputJson === 'object' && !Array.isArray(job.inputJson)
      ? job.inputJson as Record<string, unknown>
      : {};
    const data = parseAffiliateImport(raw);
    const expectedLink = raw.expectedLink == null ? null : String(raw.expectedLink);
    if (expectedLink !== null && !/^https:\/\/meli\.la\/[A-Za-z0-9_-]+$/.test(expectedLink)) throw Error('Trabajo inválido.');
    const product = await tx.product.upsert({
      where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId } },
      update: {},
      create: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId, title: data.title, originalTitle: data.title, slug: createProductSlug(data.title, data.externalId), originalPermalink: data.url, primaryImageUrl: data.image || data.images[0] || null, imageUrls: data.images, affiliateUrl: data.affiliateUrl, status: 'CANDIDATE', aiStatus: 'PENDING', selectionReasons: ['Importado desde extensión; precio y disponibilidad pendientes de verificar.'] },
    });
    // Atomic guard against another import or manual link edit. Never overwrite silently.
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${product.id} FOR UPDATE`;
    const current = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    const saved = await tx.product.updateMany({
      where: {
        id: product.id,
        OR: [{ affiliateUrl: data.affiliateUrl }, ...(expectedLink === null
          ? [{ affiliateUrl: null }, { affiliateUrl: '' }]
          : [{ affiliateUrl: expectedLink }])],
      },
      data: { affiliateUrl: data.affiliateUrl, imageUrls: mergeProductImages(current.imageUrls, data.images) },
    });
    await tx.jobExecution.update({ where: { id: jobId }, data: {
      status: saved.count ? 'SUCCEEDED' : 'FAILED', finishedAt: new Date(),
      errorMessage: saved.count ? null : 'El producto ya tiene otro enlace. Confirmá el reemplazo desde el admin.',
      outputJson: { productId: product.id },
    } });
    return saved.count ? product.id : null;
  });
  if (productId) await generateAndSaveProductEditorial(productId, db).catch(() => undefined);
}
