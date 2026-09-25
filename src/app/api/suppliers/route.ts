import { Prisma } from '@prisma/client';
import { hasAdminApiSession } from '@/lib/admin-api';
import { parseSupplierInput } from '@/lib/supplier-form';
import { createSupplier, listSuppliers } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function jsonInput(request: Request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 32_768) throw new Error('payload');
  const input = await request.json();
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('payload');
  return input as Record<string, unknown>;
}

export async function GET() {
  if (!await hasAdminApiSession()) return error('No autorizado.', 401);
  return Response.json({ suppliers: await listSuppliers() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!await hasAdminApiSession()) return error('No autorizado.', 401);
  let input: Record<string, unknown>;
  try {
    input = await jsonInput(request);
  } catch {
    return error('Payload inválido.', 400);
  }
  const parsed = parseSupplierInput(input);
  if (!parsed.success) return error(parsed.error.issues[0]?.message || 'Datos inválidos.', 400);
  try {
    return Response.json({ supplier: await createSupplier(parsed.data) }, { status: 201 });
  } catch (saveError) {
    if (saveError instanceof Prisma.PrismaClientKnownRequestError && saveError.code === 'P2002') return error('El slug ya existe.', 409);
    return error('No se pudo crear el proveedor.', 500);
  }
}
