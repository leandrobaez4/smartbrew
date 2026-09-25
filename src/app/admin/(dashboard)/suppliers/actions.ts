'use server';

import { Prisma, SupplierStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import { parseSupplierFormData, supplierCreateData, supplierUpdateData } from '@/lib/supplier-form';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);

function supplierPath(id?: string, message?: string) {
  const base = id ? `/admin/suppliers/${id}` : '/admin/suppliers/new';
  return message ? `${base}?error=${encodeURIComponent(message)}` : base;
}

function validationMessage(result: ReturnType<typeof parseSupplierFormData>) {
  if (result.success) return null;
  return result.error.issues[0]?.message || 'Revisá los datos del proveedor.';
}

function saveMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'Ya existe un proveedor con ese slug.';
  }
  if (error instanceof Error && error.message.includes('encryption is not configured')) {
    return 'Configurá SUPPLIER_CREDENTIALS_ENCRYPTION_KEY antes de guardar credenciales.';
  }
  return 'No se pudo guardar el proveedor.';
}

export async function createSupplierAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseSupplierFormData(formData);
  const error = validationMessage(parsed);
  if (error || !parsed.success) redirect(supplierPath(undefined, error || undefined));

  let destination: string;
  try {
    const supplier = await portalDb.supplier.create({ data: supplierCreateData(parsed.data) });
    revalidatePath('/admin/suppliers');
    destination = `/admin/suppliers/${supplier.id}?saved=1`;
  } catch (saveError) {
    destination = supplierPath(undefined, saveMessage(saveError));
  }
  redirect(destination);
}

export async function updateSupplierAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/suppliers');
  const parsed = parseSupplierFormData(formData);
  const error = validationMessage(parsed);
  if (error || !parsed.success) redirect(supplierPath(id, error || undefined));

  let destination: string;
  try {
    await portalDb.supplier.update({ where: { id }, data: supplierUpdateData(parsed.data, id) });
    revalidatePath('/admin/suppliers');
    revalidatePath(`/admin/suppliers/${id}`);
    destination = `/admin/suppliers/${id}?saved=1`;
  } catch (saveError) {
    destination = supplierPath(id, saveMessage(saveError));
  }
  redirect(destination);
}

export async function setSupplierStatusAction(id: string, status: SupplierStatus) {
  await requireAdmin();
  if (!validId(id) || !Object.values(SupplierStatus).includes(status)) return;
  await portalDb.supplier.update({ where: { id }, data: { status } });
  revalidatePath('/admin/suppliers');
  revalidatePath(`/admin/suppliers/${id}`);
}

export async function syncSupplierAction(id: string) {
  await requireAdmin();
  if (!validId(id)) return;
  await portalDb.supplier.update({ where: { id }, data: { lastSyncAt: new Date() } });
  revalidatePath('/admin/suppliers');
  revalidatePath(`/admin/suppliers/${id}`);
}

export async function deleteSupplierAction(id: string) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/suppliers');
  await portalDb.supplier.delete({ where: { id } });
  revalidatePath('/admin/suppliers');
  redirect('/admin/suppliers');
}
