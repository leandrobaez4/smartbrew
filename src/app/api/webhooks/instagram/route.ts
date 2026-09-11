import { after, NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { enqueueInstagramJob } from '@/lib/queue/instagram-queue';
import { logSystemEvent } from '@/lib/logger';
import { describeInstagramWebhook, dispatchInstagramWebhook } from '@/lib/instagram-webhook';

export const dynamic = 'force-dynamic';

/**
 * Verificación del Webhook por parte de Meta (Handshake inicial)
 * Meta envía una petición GET con hub.mode, hub.verify_token y hub.challenge
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'smartbrew_secret_webhook_2026';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[IG Webhook] Handshake verificado con éxito por Meta.');
    return new Response(challenge, { status: 200 });
  }

  console.warn('[IG Webhook] Handshake rechazado. Token recibido no coincide con INSTAGRAM_WEBHOOK_VERIFY_TOKEN.');
  return new Response('Verificación fallida: token incorrecto', { status: 403 });
}

/**
 * Recepción de eventos en tiempo real (Comentarios, DMs)
 * Encola las tareas inmediatamente para responder 200 OK a Meta en <50ms
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const hostname = request.nextUrl.hostname;
  const host = ['www.smartbrew.tech', 'smartbrew.tech', 'smartbrew-rouge.vercel.app', 'smartbrew-baez3.vercel.app'].includes(hostname)
    ? hostname : 'other';
  const started = Date.now();
  const audit = (level: 'INFO' | 'WARN' | 'ERROR', source: string, details: Record<string, unknown>) => {
    const safeDetails = { requestId, host, ...details };
    console.log(`[IG Webhook] ${source}`, safeDetails);
    after(() => logSystemEvent(level, source, 'Diagnóstico del webhook de Instagram', safeDetails));
  };
  audit('INFO', 'instagram_webhook_received', { stage: 'received' });
  let stage = 'parse';
  try {
    const body = await request.json();
    audit('INFO', 'instagram_webhook_shape', describeInstagramWebhook(body));
    stage = 'enqueue';
    const result = await dispatchInstagramWebhook(body, enqueueInstagramJob);
    audit(result.reason === 'enqueued' ? 'INFO' : 'WARN',
      result.reason === 'enqueued' ? 'instagram_webhook_enqueued' : 'instagram_webhook_ignored',
      { ...result, durationMs: Date.now() - started });
    return NextResponse.json({ status: result.status }, { status: 200 });
  } catch {
    // Parser/SDK errors can contain request content or credential-bearing URLs.
    audit('ERROR', 'instagram_webhook_failed', { stage, reason: stage === 'parse' ? 'invalid_json' : 'enqueue_failed', durationMs: Date.now() - started });
    return NextResponse.json({ error: 'Webhook processing failed', requestId }, { status: 500 });
  }
}
