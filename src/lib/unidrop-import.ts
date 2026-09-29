import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const nullablePositiveNumber = z.number().finite().positive().nullable().optional();

const unidropImage = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'La imagen de Unidrop debe usar HTTPS.');

export const UnidropSnapshotSchema = z.object({
  version: z.literal(1),
  supplier: z.literal('unidrop'),
  sourceProductId: z.string().regex(/^\d{1,20}$/),
  externalId: z.string().regex(/^\d{1,20}:[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/),
  sku: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/),
  ean: nullableText(160),
  title: z.string().trim().min(2).max(500),
  description: nullableText(10_000),
  brand: nullableText(160),
  category: nullableText(300),
  costArs: z.number().finite().nonnegative().max(1_000_000_000),
  priceWithProfitArs: z.number().finite().nonnegative().max(1_000_000_000).nullable().optional(),
  stock: z.number().int().nonnegative().max(1_000_000),
  images: z.array(unidropImage).max(30),
  package: z.object({
    weightGrams: nullablePositiveNumber,
    heightCm: nullablePositiveNumber,
    widthCm: nullablePositiveNumber,
    lengthCm: nullablePositiveNumber,
  }).strict(),
  shippingReference: z.object({
    platform: z.literal('TIENDANUBE'),
    amountArs: z.number().finite().nonnegative().max(1_000_000_000),
  }).strict().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()),
  sourceUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['https://www.unidrop.com.ar', 'https://unidrop.com.ar'].includes(url.origin)
      && /^\/panel\/catalogue\/\d+(?:\/|$)/.test(url.pathname);
  }, 'La URL no pertenece a una ficha de Unidrop.'),
  capturedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if (value.externalId !== `${value.sourceProductId}:${value.sku}`) {
    context.addIssue({
      code: 'custom',
      message: 'La identidad debe combinar productId:SKU.',
      path: ['externalId'],
    });
  }
});

export type UnidropSnapshot = z.infer<typeof UnidropSnapshotSchema>;

export const UnidropImportCommandSchema = z.object({
  version: z.literal(1),
  command: z.literal('IMPORT_SUPPLIER_PRODUCT'),
  supplierSlug: z.literal('unidrop'),
  externalId: z.string().regex(/^\d{1,20}:[A-Za-z0-9][A-Za-z0-9._/-]{0,159}$/),
  snapshot: UnidropSnapshotSchema,
}).strict().refine((value) => value.externalId === value.snapshot.externalId, {
  message: 'El producto no coincide con el comando de importación.',
  path: ['externalId'],
});

export function decodeUnidropImportPayload(payload: string) {
  if (!payload || payload.length > 60_000 || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const decoded: unknown = JSON.parse(json);
    const command = UnidropImportCommandSchema.safeParse(decoded);
    return command.success ? command.data.snapshot : null;
  } catch {
    return null;
  }
}
