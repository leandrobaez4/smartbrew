import { Receiver } from '@upstash/qstash';
import { processAffiliateImport } from '@/lib/affiliate-import';
import { portalDb } from '@/lib/portal';

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return Response.json({ error: 'Cola no configurada.' }, { status: 503 });
  const body = await request.text();
  if (body.length > 2048) return Response.json({ error: 'Payload inválido.' }, { status: 400 });
  try {
    const valid = await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body, url: request.url });
    if (!valid) throw Error('signature');
  } catch { return Response.json({ error: 'Firma inválida.' }, { status: 401 }); }
  let jobId: string;
  try {
    jobId = JSON.parse(body).jobId;
    if (typeof jobId !== 'string' || !/^affiliate_[a-f0-9]{64}$/.test(jobId)) throw Error('payload');
  } catch { return Response.json({ error: 'Payload inválido.' }, { status: 400 }); }
  try {
    await processAffiliateImport(jobId);
    return Response.json({ success: true });
  } catch {
    await portalDb.jobExecution.updateMany({ where: { id: jobId, jobName: 'affiliate_import', status: { not: 'SUCCEEDED' } }, data: { status: 'FAILED', errorMessage: 'Falló el procesamiento. Revisá los intentos en QStash; puede haber un reintento pendiente.' } }).catch(() => undefined);
    return Response.json({ error: 'No se completó la importación; QStash puede reintentar.' }, { status: 500 });
  }
}
