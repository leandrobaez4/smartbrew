import { PrismaClient } from '@prisma/client';
import { Client } from '@upstash/qstash';
import { adInput, adsConfig, createPausedAd } from '../meta-ads';
import { safeAffiliateUrl } from '../product-url';
import { MetaApiError } from '../meta-api';

const db = new PrismaClient();
const jobName = 'meta_paused_ad';
export async function enqueuePausedAd(raw: unknown) {
  const input = adInput.parse(raw);
  const config = adsConfig();
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY || !process.env.APP_URL) throw Error('Falta configurar QStash.');
  const url = new URL('/api/queue/meta-ads', process.env.APP_URL);
  if (url.protocol !== 'https:') throw Error('APP_URL debe usar HTTPS.');
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${input.productId} FOR UPDATE`;
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });
    if (product.status !== 'ACTIVE' || !safeAffiliateUrl(product.affiliateUrl) || !product.primaryImageUrl) throw Error('El producto necesita ficha pública activa, enlace e imagen.');
    // Even failed attempts may have created remote entities. Never replay blindly.
    const previous = await tx.jobExecution.findFirst({ where: { jobName, entityId: input.productId } });
    if (previous) return { id: previous.id, existing: true };
    const job = await tx.jobExecution.create({ data: { jobName, entityType: 'product', entityId: input.productId, status: 'STARTED', inputJson: { ...input, accountId: config.account } } });
    return { id: job.id, existing: false };
  });
  if (result.existing) return result;
  try {
    await new Client({ token: process.env.QSTASH_TOKEN }).publishJSON({
      url: url.href, body: { jobId: result.id }, deduplicationId: result.id, retries: 3, timeout: '90s',
      flowControl: { key: 'smartbrew-meta-ads', parallelism: 1 },
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : undefined,
    });
  } catch { throw Error('Envío incierto a QStash. Se reservó el intento; revisá el estado antes de repetir.'); }
  return result;
}

export async function processPausedAd(jobId: string) {
  const job = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "JobExecution" WHERE id = ${jobId} FOR UPDATE`;
    const found = await tx.jobExecution.findUnique({ where: { id: jobId } });
    if (!found || found.jobName !== jobName) throw Error('Trabajo inválido.');
    if (found.status !== 'STARTED' || found.outputJson) return null;
    await tx.jobExecution.update({ where: { id: jobId }, data: { outputJson: { phase: 'CLAIMED' } } });
    return found;
  });
  if (!job) return;
  let ids: Record<string, string> = {};
  try {
    const input = adInput.parse(job.inputJson);
    const saved = job.inputJson as { accountId?: string };
    if (saved.accountId !== adsConfig().account) throw Error('Cambió la cuenta publicitaria. Revisar configuración.');
    const product = await db.product.findUniqueOrThrow({ where: { id: input.productId } });
    if (product.status !== 'ACTIVE' || !safeAffiliateUrl(product.affiliateUrl) || !product.primaryImageUrl) throw Error('La ficha pública ya no está disponible.');
    await createPausedAd(input, { title: product.title, primaryImageUrl: product.primaryImageUrl }, async created => {
      ids = created;
      await db.jobExecution.update({ where: { id: jobId }, data: { outputJson: { phase: 'CREATING_PAUSED', ...ids } } });
    });
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'SUCCEEDED', finishedAt: new Date(), outputJson: { phase: 'PAUSED', ...ids } } });
  } catch (error) {
    const code = error instanceof MetaApiError ? ` HTTP ${error.status ?? 'red'} / código ${error.code ?? 'sin código'}` : '';
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'FAILED', finishedAt: new Date(), outputJson: { phase: 'REVIEW_REQUIRED', ...ids }, errorMessage: `No se completó la creación.${code} Revisá cuenta, moneda, permisos e IDs en Meta antes de reintentar. No se activó ningún anuncio.` } });
  }
}
