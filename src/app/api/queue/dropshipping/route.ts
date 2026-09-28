import { Receiver } from '@upstash/qstash';
import {
  dispatchScheduledDropshippingJobs,
  processDropshippingQStashJob,
} from '@/lib/dropshipping-jobs';

export const maxDuration = 120;

function validJobId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return Response.json({ error: 'Faltan claves de firma.' }, { status: 503 });
  }

  const body = await request.text();
  if (body.length > 2_048) return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  try {
    const valid = await new Receiver({ currentSigningKey, nextSigningKey }).verify({
      signature: request.headers.get('upstash-signature') || '',
      body,
      url: request.url,
    });
    if (!valid) throw new Error('signature');
  } catch {
    return Response.json({ error: 'Firma inválida.' }, { status: 401 });
  }

  let payload: { jobId?: unknown; schedule?: unknown };
  try {
    payload = JSON.parse(body) as { jobId?: unknown; schedule?: unknown };
  } catch {
    return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  try {
    if (payload.schedule === 'dropshipping') {
      const result = await dispatchScheduledDropshippingJobs();
      return Response.json({ received: true, ...result });
    }
    if (!validJobId(payload.jobId)) return Response.json({ error: 'Payload inválido.' }, { status: 400 });
    const result = await processDropshippingQStashJob(payload.jobId);
    return Response.json({ received: true, result });
  } catch {
    return Response.json({ error: 'No se pudo procesar el trabajo de dropshipping.' }, { status: 500 });
  }
}
