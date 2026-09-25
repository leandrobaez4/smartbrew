import { logSystemEvent } from '@/lib/logger';
import { parseMercadoLibreNotification, processMercadoLibreNotification } from '@/lib/mercado-libre-orders';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 64 * 1024) return new Response('Payload too large', { status: 413 });
  let notification;
  try {
    notification = parseMercadoLibreNotification(JSON.parse(raw));
  } catch {
    return Response.json({ error: 'Invalid notification' }, { status: 400 });
  }

  try {
    const result = await processMercadoLibreNotification(notification);
    return Response.json({ received: true, status: result.status });
  } catch (error) {
    await logSystemEvent('ERROR', 'mercado_libre_webhook', 'Mercado Libre webhook request failed', {
      topic: notification.topic,
      resource: notification.resource,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return Response.json({ error: 'Webhook processing failed' }, { status: 503 });
  }
}
