import OpenAI from 'openai';
import { Prisma, PrismaClient, SupplierProductEditorialStatus } from '@prisma/client';
import { z } from 'zod';

export const SupplierProductEditorialSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(40).max(2_000),
  bulletPoints: z.array(z.string().trim().min(3).max(220)).min(3).max(8),
  productHighlights: z.array(z.string().trim().min(3).max(220)).min(2).max(6),
  seoKeywords: z.array(z.string().trim().min(2).max(60)).min(2).max(12),
}).strict();

export type SupplierProductEditorial = z.infer<typeof SupplierProductEditorialSchema>;

export type SupplierProductEditorialInput = {
  supplierTitle: string;
  supplierDescription?: string | null;
  attributes?: Record<string, unknown> | null;
  brand?: string | null;
  category?: string | null;
};

export function supplierProductEditorialPrompt(input: SupplierProductEditorialInput) {
  return `Sos editor de publicaciones de productos para SmartBrew.

Generá contenido comercial claro usando exclusivamente los datos del proveedor incluidos abajo.

Reglas obligatorias:
- No inventes especificaciones, garantías, accesorios, compatibilidades, materiales ni características.
- No completes datos ausentes por conocimiento general.
- Conservá marca y modelo solamente cuando estén respaldados por la entrada.
- Si un dato no está presente, omitilo.
- Devolvé exclusivamente JSON válido con estas claves exactas: title, description, bulletPoints, productHighlights, seoKeywords.

Datos reales del proveedor:
${JSON.stringify(input)}

Formato:
{
  "title": "título verificable de hasta 120 caracteres",
  "description": "descripción basada solamente en la entrada",
  "bulletPoints": ["3 a 8 puntos verificables"],
  "productHighlights": ["2 a 6 destacados verificables"],
  "seoKeywords": ["2 a 12 términos derivados del producto"]
}`;
}

function json(value: string[]): Prisma.InputJsonValue {
  return value;
}

export async function generateSupplierProductEditorial(
  input: SupplierProductEditorialInput,
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: supplierProductEditorialPrompt(input) }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido para el producto del proveedor.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI devolvió contenido JSON inválido.');
  }
  return SupplierProductEditorialSchema.parse(parsed);
}

export async function generateAndSaveSupplierProductEditorial(productId: string, db: PrismaClient) {
  await db.supplierProduct.update({
    where: { id: productId },
    data: { editorialStatus: SupplierProductEditorialStatus.PROCESSING, editorialError: null },
  });
  try {
    const product = await db.supplierProduct.findUniqueOrThrow({ where: { id: productId } });
    const attributes = product.attributes && !Array.isArray(product.attributes) && typeof product.attributes === 'object'
      ? product.attributes as Record<string, unknown>
      : undefined;
    const editorial = await generateSupplierProductEditorial({
      supplierTitle: product.title,
      supplierDescription: product.description,
      attributes,
      brand: product.brand,
      category: product.category,
    });
    await db.supplierProduct.update({
      where: { id: productId },
      data: {
        editorialTitle: editorial.title,
        editorialDescription: editorial.description,
        editorialBulletPoints: json(editorial.bulletPoints),
        editorialHighlights: json(editorial.productHighlights),
        editorialSeoKeywords: editorial.seoKeywords,
        editorialStatus: SupplierProductEditorialStatus.READY,
        editorialError: null,
        editorialGeneratedAt: new Date(),
        editorialReviewedAt: null,
      },
    });
    return editorial;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al generar contenido.';
    await db.supplierProduct.update({
      where: { id: productId },
      data: { editorialStatus: SupplierProductEditorialStatus.FAILED, editorialError: message.slice(0, 1_000) },
    });
    throw error;
  }
}
