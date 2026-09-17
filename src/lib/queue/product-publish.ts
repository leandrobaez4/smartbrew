import { PrismaClient } from '@prisma/client';
import { Client } from '@upstash/qstash';
import { publishOne, errorMessage } from '../instagram-publish';

const db = new PrismaClient();
export async function enqueueProductPublish(productId: string) {
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY || !process.env.APP_URL) throw Error('Configurá QStash, sus dos claves de firma y APP_URL.');
  const url = new URL('/api/queue/product-publish', process.env.APP_URL);
  if (url.protocol !== 'https:') throw Error('APP_URL debe usar HTTPS.');
  const job = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
    const product = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    if (!product.affiliateUrl || !product.primaryImageUrl) throw Error('El producto necesita imagen y enlace de afiliado.');
    const pending = await tx.jobExecution.findFirst({ where: { jobName: 'instagram_product_publish', entityId: productId, status: 'STARTED' } });
    if (pending) return { job: pending, alreadyQueued: true };
    const active = await tx.publication.findFirst({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null, status: { in: ['PUBLISHED', 'QUEUED', 'UPLOADING', 'PROCESSING'] } } });
    if (active) throw Error('Ya está publicado o tiene una operación pendiente de conciliación.');
    const created = await tx.jobExecution.create({ data: { jobName: 'instagram_product_publish', entityId: productId, entityType: 'product', status: 'STARTED' } });
    return { job: created, alreadyQueued: false };
  });
  if (job.alreadyQueued) {
    if (job.job.outputJson && Date.now() - job.job.startedAt.getTime() > 180000) throw Error('Intento interrumpido: verificá y conciliá su resultado antes de volver a publicar.');
    return { jobId: job.job.id, alreadyQueued: true };
  }
  try {
    await new Client({ token: process.env.QSTASH_TOKEN }).publishJSON({
      url: url.href, body: { jobId: job.job.id }, deduplicationId: job.job.id, retries: 3,
      flowControl: { key: 'smartbrew-product-publish', parallelism: 1 },
      timeout: '90s',
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : undefined,
    });
  } catch { throw Error('No se confirmó el envío a QStash. El trabajo quedó reservado para evitar duplicados; revisá QStash antes de recuperarlo.'); }
  return { jobId: job.job.id, alreadyQueued: false };
}

export async function processProductPublish(jobId: string) {
  const claim = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "JobExecution" WHERE id = ${jobId} FOR UPDATE`;
    const job = await tx.jobExecution.findUnique({ where: { id: jobId } });
    if (!job || job.jobName !== 'instagram_product_publish' || !job.entityId) throw Error('Trabajo inválido.');
    if (job.status !== 'STARTED') return null;
    if (job.outputJson) {
      // A crashed or timed-out worker must be reconciled, not blindly republished.
      if (Date.now() - job.startedAt.getTime() > 180000) {
        await tx.jobExecution.update({ where: { id: jobId }, data: { status: 'FAILED', errorMessage: 'Intento interrumpido; verificar Instagram y conciliar antes de reintentar.', finishedAt: new Date() } });
      }
      return null;
    }
    await tx.jobExecution.update({ where: { id: jobId }, data: { outputJson: { phase: 'CLAIMED' }, startedAt: new Date() } });
    return job.entityId;
  });
  if (!claim) return;
  try {
    await publishOne(claim);
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'SUCCEEDED', finishedAt: new Date(), outputJson: { phase: 'PUBLISHED' }, errorMessage: null } });
  } catch (error) {
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'FAILED', finishedAt: new Date(), errorMessage: errorMessage(error) } });
    // Business failure is durably recorded. QStash must not create another publication.
  }
}
