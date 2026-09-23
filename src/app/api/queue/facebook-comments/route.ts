import { Receiver } from '@upstash/qstash';
import { processFacebookComment } from '../../../../lib/queue/facebook-comments';

export const maxDuration = 60;
export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return new Response('Not configured', { status: 503 });
  const body = await request.text();
  if (body.length > 2048) return new Response('Invalid payload', { status: 400 });
  try {
    if (!await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body, url: request.url })) throw Error('signature');
  } catch { return new Response('Forbidden', { status: 401 }); }
  let jobId: string;
  try {
    jobId = JSON.parse(body).jobId;
    if (typeof jobId !== 'string' || !/^fb_[a-f0-9]{64}$/.test(jobId)) throw Error('id');
  } catch { return new Response('Invalid payload', { status: 400 }); }
  try { return Response.json({ result: await processFacebookComment(jobId) }); }
  catch { return new Response('Processing failed', { status: 503 }); }
}
