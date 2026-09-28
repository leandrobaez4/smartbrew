import { z } from 'zod';
import { hasAdminApiSession } from '@/lib/admin-api';
import { DropshippingJobName, enqueueDropshippingJob } from '@/lib/dropshipping-jobs';
import { portalDb } from '@/lib/portal';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  marketplaceAccountId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  marketplaceFee: z.number().finite().nonnegative(),
  shippingCost: z.number().finite().nonnegative(),
  taxes: z.number().finite().nonnegative(),
  extraCosts: z.number().finite().nonnegative(),
  targetMarginPercentage: z.number().finite().min(0).lt(100),
}).strict();

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const failure = (error: string, status: number) => Response.json({ error }, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasAdminApiSession()) return failure('No autorizado.', 401);
  const { id } = await context.params;
  const jobId = new URL(request.url).searchParams.get('jobId') || '';
  if (!validId(id) || !validId(jobId)) return failure('Identificador inválido.', 400);
  const job = await portalDb.jobExecution.findFirst({
    where: {
      id: jobId,
      jobName: DropshippingJobName.MarketplacePublishJob,
      entityType: 'SupplierProduct',
      entityId: id,
    },
    select: { status: true, errorMessage: true, outputJson: true },
  });
  if (!job) return failure('No se encontró el trabajo de publicación.', 404);
  const output = job.outputJson && typeof job.outputJson === 'object' && !Array.isArray(job.outputJson)
    ? job.outputJson as Record<string, unknown>
    : {};
  return Response.json({
    status: job.status,
    error: job.errorMessage,
    dryRun: output.dryRun === true,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasAdminApiSession()) return failure('No autorizado.', 401);
  const { id } = await context.params;
  if (!validId(id)) return failure('Identificador inválido.', 400);
  let body: unknown;
  try {
    if (Number(request.headers.get('content-length') || 0) > 16_384) throw new Error('payload');
    body = await request.json();
  } catch {
    return failure('Payload inválido.', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return failure('Datos de publicación inválidos.', 400);

  try {
    const result = await enqueueDropshippingJob(DropshippingJobName.MarketplacePublishJob, { supplierProductId: id, ...parsed.data });
    return Response.json(result, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return failure('No se pudo encolar la publicación. Revisá los registros del sistema.', 503);
  }
}
