import { z } from 'zod';
import { hasAdminApiSession } from '@/lib/admin-api';
import { resolveManualSupplierPurchase } from '@/lib/manual-supplier-purchase';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete'), reference: z.string().trim().min(1).max(160), actualCost: z.number().finite().min(0).max(1_000_000_000) }).strict(),
  z.object({ action: z.literal('error'), error: z.string().trim().min(1).max(500) }).strict(),
]);
const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const failure = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasAdminApiSession()) return failure('No autorizado.', 401);
  const { id } = await context.params;
  if (!validId(id)) return failure('Identificador inválido.', 400);
  let body: unknown;
  try {
    if (Number(request.headers.get('content-length') || 0) > 8_192) throw new Error('payload');
    body = await request.json();
  } catch {
    return failure('Payload inválido.', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return failure('Datos de compra manual inválidos.', 400);
  try {
    return Response.json(await resolveManualSupplierPurchase(id, parsed.data), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar la compra manual.';
    if (message.includes('No existe') || message.includes('no corresponde')) return failure(message, 404);
    if (message.includes('Ingresá') || message.includes('Describí')) return failure(message, 400);
    return failure('No se pudo actualizar la compra manual.', 500);
  }
}
