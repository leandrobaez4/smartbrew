import { Supplier } from '@prisma/client';
import { portalDb } from './portal';
import { SupplierFormInput, supplierCreateData, supplierUpdateData } from './supplier-form';

export function supplierResponse(supplier: Supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    slug: supplier.slug,
    type: supplier.type,
    website: supplier.website,
    apiUrl: supplier.apiUrl,
    integrationType: supplier.integrationType,
    status: supplier.status,
    lastSyncAt: supplier.lastSyncAt,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    credentialsConfigured: {
      apiKey: Boolean(supplier.apiKeyEncrypted),
      apiSecret: Boolean(supplier.apiSecretEncrypted),
      username: Boolean(supplier.usernameEncrypted),
      password: Boolean(supplier.passwordEncrypted),
    },
  };
}

export async function listSuppliers() {
  const suppliers = await portalDb.supplier.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  return suppliers.map(supplierResponse);
}

export async function getSupplier(id: string) {
  const supplier = await portalDb.supplier.findUnique({ where: { id } });
  return supplier ? supplierResponse(supplier) : null;
}

export async function createSupplier(input: SupplierFormInput) {
  return supplierResponse(await portalDb.supplier.create({ data: supplierCreateData(input) }));
}

export async function updateSupplier(id: string, input: SupplierFormInput) {
  return supplierResponse(await portalDb.supplier.update({ where: { id }, data: supplierUpdateData(input, id) }));
}

export async function removeSupplier(id: string) {
  await portalDb.supplier.delete({ where: { id } });
}
