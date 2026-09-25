import { Prisma } from '@prisma/client';
import { hasAdminApiSession } from '@/lib/admin-api';
import { parseSupplierInput } from '@/lib/supplier-form';
import { getSupplier, removeSupplier, updateSupplier } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
type SupplierRouteContext = { params: Promise<{ id: string }> };

async function authorizedId(context: SupplierRouteContext) {
  if (!await hasAdminApiSession()) return { response: error('No autorizado.', 401) };
  const { id } = await context.params;
  if (!validId(id)) return { response: error('Identificador inválido.', 400) };
  return { id };
}

export async function GET(_request: Request, context: SupplierRouteContext) {
  const target = await authorizedId(context);
  if ('response' in target) return target.response;
  const supplier = await getSupplier(target.id);
  return supplier ? Response.json({ supplier }, { headers: { 'Cache-Control': 'no-store' } }) : error('Proveedor no encontrado.', 404);
}

export async function PUT(request: Request, context: SupplierRouteContext) {
  const target = await authorizedId(context);
  if ('response' in target) return target.response;
  let input: unknown;
  try {
    if (Number(request.headers.get('content-length') || 0) > 32_768) throw new Error('payload');
    input = await request.json();
  } catch {
    return error('Payload inválido.', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return error('Payload inválido.', 400);
  const parsed = parseSupplierInput(input as Record<string, unknown>);
  if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Datos inválidos.', 400);
  try {
    return Response.json({ supplier: await updateSupplier(target.id, parsed.data) });
  } catch (saveError) {
    if (saveError instanceof Prisma.PrismaClientKnownRequestError && saveError.code === 'P2025') return error('Proveedor no encontrado.', 404);
    if (saveError instanceof Prisma.PrismaClientKnownRequestError && saveError.code === 'P2002') return error('El slug ya existe.', 409);
    return error('No se pudo actualizar el proveedor.', 500);
  }
}

export async function DELETE(_request: Request, context: SupplierRouteContext) {
  const target = await authorizedId(context);
  if ('response' in target) return target.response;
  try {
    await removeSupplier(target.id);
    return new Response(null, { status: 204 });
  } catch (deleteError) {
    if (deleteError instanceof Prisma.PrismaClientKnownRequestError && deleteError.code === 'P2025') return error('Proveedor no encontrado.', 404);
    return error('No se pudo eliminar el proveedor.', 500);
  }
}
