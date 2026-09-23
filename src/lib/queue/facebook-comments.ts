import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Client } from '@upstash/qstash';
import { facebookComment, facebookProductId, type FacebookComment } from '../facebook-comments';
import { safeAffiliateUrl } from '../product-url';

const db = new PrismaClient();
const jobName = 'facebook_info_reply';
export async function enqueueFacebookComment(input: FacebookComment) {
  const comment = facebookComment.parse(input);
  const productId = facebookProductId(comment.postId);
  if (!productId) {
    // IDs only: no comment text, profile names or tokens in logs.
    console.warn('[Facebook] unmapped_post', { postId: comment.postId });
    return 'unmapped';
  }
  if (!process.env.QSTASH_TOKEN || !process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY || !process.env.APP_URL) throw Error('queue_config');
  const url = new URL('/api/queue/facebook-comments', process.env.APP_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('queue_url');
  const id = `fb_${createHash('sha256').update(`${comment.pageId}:${comment.commentId}`).digest('hex')}`;
  const job = await db.jobExecution.upsert({ where: { id }, update: {}, create: {
    id, jobName, entityType: 'product', entityId: productId, status: 'STARTED', inputJson: comment,
  } });
  if (job.status !== 'STARTED' || job.outputJson) return 'duplicate';
  // Re-deliver an unclaimed durable job if a previous enqueue had an uncertain outcome.
  await new Client({ token: process.env.QSTASH_TOKEN }).publishJSON({
    url: url.href, body: { jobId: id }, deduplicationId: id, retries: 3,
    flowControl: { key: 'smartbrew-facebook-comments', parallelism: 1 },
    headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : undefined,
  });
  return 'enqueued';
}

export async function processFacebookComment(jobId: string) {
  if (process.env.FACEBOOK_COMMENTS_ENABLED !== 'true') throw Error('disabled');
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const version = process.env.FACEBOOK_GRAPH_API_VERSION || 'v26.0';
  if (!token || !pageId || !/^\d+$/.test(pageId) || !/^v\d+\.0$/.test(version)) throw Error('facebook_config');
  const job = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "JobExecution" WHERE id = ${jobId} FOR UPDATE`;
    const current = await tx.jobExecution.findUnique({ where: { id: jobId } });
    if (!current || current.jobName !== jobName) throw Error('job_not_found');
    if (current.status !== 'STARTED' || current.outputJson) return null;
    await tx.jobExecution.update({ where: { id: jobId }, data: { outputJson: { phase: 'CLAIMED' } } });
    return current;
  });
  if (!job) return 'duplicate_or_review_required';
  let sent = false;
  try {
    const comment = facebookComment.parse(job.inputJson);
    if (comment.pageId !== pageId || !comment.postId.startsWith(`${pageId}_`) || facebookProductId(comment.postId) !== job.entityId) throw Error('mapping_changed');
    const product = job.entityId ? await db.product.findUnique({ where: { id: job.entityId } }) : null;
    const link = safeAffiliateUrl(product?.affiliateUrl ?? null);
    if (!product || product.status !== 'ACTIVE' || !link) throw Error('product_unavailable');
    const response = await fetch(`https://graph.facebook.com/${version}/${pageId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: comment.commentId }, message: {
        text: `¡Hola! 👋 Acá tenés el enlace para "${product.title}":\n\n${link}\n\nEs un enlace de afiliado de SmartBrew.`,
      } }), signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok || data.error || typeof data.message_id !== 'string' || !data.message_id) {
      const code = typeof data.error?.code === 'number' ? data.error.code : 'unknown';
      throw Error(`meta_http_${response.status}_code_${code}`);
    }
    sent = true;
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'SUCCEEDED', finishedAt: new Date(), outputJson: { phase: 'SENT', messageId: data.message_id } } });
    console.info('[Facebook] reply_sent', { jobId });
    return 'sent';
  } catch (error) {
    // Do not retry a possible send: timeouts/DB failures may happen after Meta accepted it.
    const reason = error instanceof Error && /^(mapping_changed|product_unavailable|meta_http_\d+_code_(\d+|unknown))$/.test(error.message) ? error.message : 'uncertain_result';
    await db.jobExecution.update({ where: { id: jobId }, data: { status: 'FAILED', finishedAt: new Date(), errorMessage: reason, outputJson: { phase: 'REVIEW_REQUIRED', metaAccepted: sent } } });
    console.warn('[Facebook] reply_review_required', { jobId, reason });
    return 'review_required';
  }
}
