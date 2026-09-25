import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);
const nullableNumber = z.number().finite().nonnegative().nullable();
const elitImage = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.origin === 'https://images.elit.com.ar' && !url.username && !url.password;
}, 'La imagen no pertenece a Elit.');

export const ElitImportProductSchema = z.object({
  supplier: z.literal('elit'),
  externalId: z.string().regex(/^\d{1,20}$/),
  sku: nullableText(160),
  ean: nullableText(160),
  title: z.string().trim().min(2).max(300),
  description: nullableText(10_000),
  brand: nullableText(160),
  category: nullableText(300),
  stock: z.number().int().nonnegative().nullable(),
  images: z.array(elitImage).max(20),
  attributes: z.record(z.string(), z.unknown()),
  sourceUrl: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['https://www.elit.com.ar', 'https://elit.com.ar'].includes(url.origin)
      && /^\/producto\/\d+(?:[-/]|$)/.test(url.pathname);
  }),
  rawData: z.record(z.string(), z.unknown()),
  pricing: z.object({
    supplierPriceUsd: nullableNumber,
    exchangeRateArsPerUsd: nullableNumber,
    supplierPriceArs: nullableNumber,
    vatPercentage: z.number().finite().nonnegative().lt(100),
    vatAmountUsd: nullableNumber,
    vatAmountArs: nullableNumber,
    supplierCostWithVatUsd: nullableNumber,
    supplierCostWithVatArs: nullableNumber,
  }),
}).passthrough();

export type ElitImportProduct = z.infer<typeof ElitImportProductSchema>;

export function decodeElitImportPayload(payload: string) {
  if (!payload || payload.length > 40_000 || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = ElitImportProductSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
