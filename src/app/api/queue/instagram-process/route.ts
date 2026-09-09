import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processInstagramComment, processInstagramDirectMessage } from '@/lib/instagram-bot';
import { InstagramJobPayload } from '@/lib/queue/instagram-queue';
import { getMetaErrorDetails } from '@/lib/meta-api';
import { logSystemEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Endpoint consumidor de la cola de Instagram
 * Invocado por QStash (o por cualquier despachador seguro) después del delay configurado
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verificación de firma criptográfica de QStash (si están configuradas las claves)
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (currentSigningKey && nextSigningKey) {
      const signature = request.headers.get('upstash-signature');
      if (!signature) {
        return NextResponse.json({ error: 'Falta encabezado de firma upstash-signature' }, { status: 401 });
      }

      const receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });

      const isValid = await receiver.verify({
        signature,
        body: rawBody,
        url: request.url,
      });

      if (!isValid) {
        console.warn('[Queue Consumer] Firma de QStash inválida rechazada.');
        return NextResponse.json({ error: 'Firma de QStash inválida' }, { status: 403 });
      }
    }

    const payload: InstagramJobPayload = JSON.parse(rawBody);

    console.log(`[Queue Consumer] Procesando tarea de cola tipo "${payload.type}" recibida.`);

    if (payload.type === 'comment') {
      await processInstagramComment(payload.data);
    } else if (payload.type === 'dm') {
      await processInstagramDirectMessage(payload.data);
    } else {
      console.warn(`[Queue Consumer] Tipo de tarea desconocido: ${payload.type}`);
    }

    return NextResponse.json({ 
      success: true, 
      type: payload.type,
      processedAt: new Date().toISOString() 
    }, { status: 200 });
  } catch (error: unknown) {
    const details = getMetaErrorDetails(error);
    const messageId = request.headers.get('upstash-message-id');
    const retried = request.headers.get('upstash-retried');
    console.error('[Queue Consumer] Error procesando tarea de la cola:', {
      messageId,
      retried,
      ...details,
    });
    await logSystemEvent('ERROR', 'queue_qstash_failed', `Falló el procesamiento de un mensaje QStash: ${String(details.message)}`, {
      messageId,
      retried,
      ...details,
    });
    // Retornamos 500 para que QStash reintente automáticamente según su política
    return NextResponse.json({
      error: String(details.message),
      messageId,
      retryable: details.retryable,
    }, { status: 500 });
  }
}
