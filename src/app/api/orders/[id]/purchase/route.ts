import { hasAdminApiSession } from '@/lib/admin-api';
import { DropshippingJobName, enqueueDropshippingJob } from '@/lib/dropshipping-jobs';

export const dynamic = 'force-dynamic';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const failure = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasAdminApiSession()) return failure('No autorizado.', 401);
  const { id } = await context.params;
  if (!validId(id)) return failure('Identificador inválido.', 400);
  try {
    const result = await enqueueDropshippingJob(DropshippingJobName.SupplierOrderJob, { orderId: id });
    return Response.json(result, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return failure('No se pudo encolar la compra. Revisá los registros del sistema.', 503);
  }
}
