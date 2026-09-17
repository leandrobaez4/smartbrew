import { Receiver } from '@upstash/qstash';
import { processProductPublish } from '@/lib/queue/product-publish';

export const maxDuration = 120;
export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return Response.json({ error: 'Faltan claves de firma.' }, { status: 503 });
  const body = await request.text();
  if (body.length > 2048) return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  try {
    if (!await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body, url: request.url })) throw Error('signature');
  } catch { return Response.json({ error: 'Firma inválida.' }, { status: 401 }); }
  let jobId: string;
  try {
    jobId = JSON.parse(body).jobId;
    if (typeof jobId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(jobId)) throw Error('payload');
  } catch { return Response.json({ error: 'Payload inválido.' }, { status: 400 }); }
  try {
    await processProductPublish(jobId);
    return Response.json({ received: true, message: 'Consultar el resultado en SmartBrew; delivered no implica publicado.' });
  } catch { return Response.json({ error: 'No se pudo procesar el trabajo.' }, { status: 500 }); }
}
