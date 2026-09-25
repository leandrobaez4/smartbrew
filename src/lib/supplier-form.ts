import { randomUUID } from 'node:crypto';
import { Prisma, SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { z } from 'zod';
import { sealSupplierCredential } from './supplier-credentials';

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const optionalUrl = z.string().trim().max(2000).refine(
  (value) => !value || URL.canParse(value),
  'Ingresá una URL válida.',
).transform((value) => value || null);

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá el nombre del proveedor.').max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usá un slug válido.').max(100),
  type: optionalText(100),
  website: optionalUrl,
  apiUrl: optionalUrl,
  integrationType: z.enum(SupplierIntegrationType),
  status: z.enum(SupplierStatus),
  apiKey: optionalText(4096),
  apiSecret: optionalText(4096),
  username: optionalText(512),
  password: optionalText(4096),
});

export type SupplierFormInput = z.infer<typeof supplierSchema>;

export function parseSupplierInput(input: Record<string, unknown>) {
  return supplierSchema.safeParse({
    ...input,
    type: input.type ?? '',
    website: input.website ?? '',
    apiUrl: input.apiUrl ?? '',
    integrationType: input.integrationType ?? SupplierIntegrationType.MANUAL,
    status: input.status ?? SupplierStatus.ACTIVE,
    apiKey: input.apiKey ?? '',
    apiSecret: input.apiSecret ?? '',
    username: input.username ?? '',
    password: input.password ?? '',
  });
}

export function parseSupplierFormData(formData: FormData) {
  return parseSupplierInput({
    name: formData.get('name'),
    slug: formData.get('slug'),
    type: formData.get('type') || '',
    website: formData.get('website') || '',
    apiUrl: formData.get('apiUrl') || '',
    integrationType: formData.get('integrationType'),
    status: formData.get('status'),
    apiKey: formData.get('apiKey') || '',
    apiSecret: formData.get('apiSecret') || '',
    username: formData.get('username') || '',
    password: formData.get('password') || '',
  });
}

const credentialColumns = {
  apiKey: 'apiKeyEncrypted',
  apiSecret: 'apiSecretEncrypted',
  username: 'usernameEncrypted',
  password: 'passwordEncrypted',
} as const;

function encryptedCredentials(input: SupplierFormInput, supplierId: string) {
  const data: Partial<Record<(typeof credentialColumns)[keyof typeof credentialColumns], string>> = {};
  for (const [field, column] of Object.entries(credentialColumns) as Array<
    [keyof typeof credentialColumns, (typeof credentialColumns)[keyof typeof credentialColumns]]
  >) {
    const value = input[field];
    if (value) data[column] = sealSupplierCredential(value, supplierId, field);
  }
  return data;
}

function publicFields(input: SupplierFormInput) {
  return {
    name: input.name,
    slug: input.slug,
    type: input.type,
    website: input.website,
    apiUrl: input.apiUrl,
    integrationType: input.integrationType,
    status: input.status,
  };
}

export function supplierCreateData(input: SupplierFormInput, id: string = randomUUID()): Prisma.SupplierCreateInput {
  return {
    id,
    ...publicFields(input),
    ...encryptedCredentials(input, id),
  };
}

export function supplierUpdateData(input: SupplierFormInput, id: string): Prisma.SupplierUpdateInput {
  return {
    ...publicFields(input),
    ...encryptedCredentials(input, id),
  };
}
