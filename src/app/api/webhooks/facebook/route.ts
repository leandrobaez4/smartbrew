import { facebookInfoComments, verifyFacebookSignature } from '../../../../lib/facebook-comments';
import { enqueueFacebookComment } from '../../../../lib/queue/facebook-comments';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (token && params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === token && params.has('hub.challenge')) return new Response(params.get('hub.challenge'));
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.FACEBOOK_APP_SECRET;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!secret || !pageId) return new Response('Not configured', { status: 503 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 262144) return new Response('Payload too large', { status: 413 });
  if (!verifyFacebookSignature(raw, request.headers.get('x-hub-signature-256'), secret)) return new Response('Forbidden', { status: 403 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  if (process.env.FACEBOOK_COMMENTS_ENABLED !== 'true') return Response.json({ status: 'disabled' });
  try {
    const comments = facebookInfoComments(body, pageId);
    for (const comment of comments) await enqueueFacebookComment(comment);
    console.info('[Facebook] webhook_processed', { eligible: comments.length });
    return Response.json({ received: true });
  } catch {
    console.error('[Facebook] enqueue_failed');
    return new Response('Queue unavailable', { status: 503 });
  }
}
