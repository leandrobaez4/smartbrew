import { NextRequest, NextResponse } from 'next/server';
import { enqueueInstagramJob } from '@/lib/queue/instagram-queue';

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
  try {
    const body = await request.json();

    // Verificamos que sea un objeto de Instagram
    if (body.object === 'instagram' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        // 1. Manejo de comentarios en publicaciones (Feed, Reels, Carruseles)
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              // Encolamos en QStash / DB con retardo controlado
              await enqueueInstagramJob('comment', change);
            }
          }
        }

        // 2. Manejo de Mensajes Directos (DMs)
        if (Array.isArray(entry.messaging)) {
          for (const messagingItem of entry.messaging) {
            // Encolamos en QStash / DB con retardo controlado
            await enqueueInstagramJob('dm', messagingItem);
          }
        }
      }

      // Meta requiere responder 200 OK inmediatamente para no reintentar
      return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    }

    return NextResponse.json({ status: 'IGNORED' }, { status: 200 });
  } catch (error: any) {
    console.error('[IG Webhook] Error parseando payload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
