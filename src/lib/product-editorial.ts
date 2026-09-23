import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const categorySchema = z.enum(['cafe', 'tecnologia', 'gadgets', 'smart-home', 'home-office']);

export const ProductEditorialSchema = z.object({
  displayTitle: z.string().trim().min(3).max(80),
  shortDescription: z.string().trim().min(20).max(320),
  description: z.string().trim().min(80).max(1600),
  whyWePickedIt: z.array(z.string().trim().min(5).max(180)).min(3).max(5),
  idealFor: z.string().trim().min(15).max(320),
  highlights: z.array(z.string().trim().min(3).max(180)).min(3).max(6),
  seoTitle: z.string().trim().min(3).max(65),
  seoDescription: z.string().trim().min(100).max(180),
  suggestedCategory: categorySchema,
  suggestedTags: z.array(z.string().trim().min(2).max(40)).min(2).max(6),
}).strict();

export type ProductEditorial = z.infer<typeof ProductEditorialSchema>;

export type ProductEditorialInput = {
  title: string;
  description?: string;
  attributes?: Record<string, string>;
  category?: string;
  brand?: string;
  model?: string;
};

export function productEditorialPrompt(input: ProductEditorialInput) {
  return `Sos el editor de productos de SmartBrew, una marca de recomendaciones de tecnología, café, gadgets y productos para mejorar el día a día.

Convertí exclusivamente la información real recibida en una ficha editorial clara, útil y confiable.

IMPORTANTE:
- No inventes especificaciones, funcionalidades, precios, materiales, compatibilidades ni beneficios.
- Si un dato no está disponible, no lo menciones.
- No afirmes que SmartBrew probó o usó el producto.
- No inventes valoraciones, popularidad, ventas ni reseñas.
- Evitá “el mejor”, “perfecto”, “imperdible” y “garantizado”.
- Escribí en español natural, claro, moderno y sin lenguaje de vendedor agresivo.
- Devolvé exclusivamente JSON válido.

Producto:
${JSON.stringify(input)}

Formato:
{
  "displayTitle": "máximo aproximado 70 caracteres; mantener marca y modelo reales",
  "shortDescription": "1 o 2 oraciones",
  "description": "entre 80 y 180 palabras",
  "whyWePickedIt": ["3 a 5 razones breves basadas en los datos"],
  "idealFor": "una frase sobre el usuario al que puede resultarle útil",
  "highlights": ["3 a 6 características reales"],
  "seoTitle": "máximo aproximado 60 caracteres",
  "seoDescription": "aproximadamente 140 a 160 caracteres",
  "suggestedCategory": "cafe | tecnologia | gadgets | smart-home | home-office",
  "suggestedTags": ["2 a 6 tags"]
}`;
}

function stringAttributes(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).flatMap(([key, item]) =>
    typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
      ? [[key, String(item)] as const]
      : []
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function generateProductEditorial(input: ProductEditorialInput, openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: productEditorialPrompt(input) }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido editorial.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI devolvió JSON inválido.');
  }
  return ProductEditorialSchema.parse(parsed);
}

export async function generateAndSaveProductEditorial(productId: string, db: PrismaClient) {
  await db.product.update({ where: { id: productId }, data: { aiStatus: 'PROCESSING', aiError: null } });
  try {
    const product = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const attributes = stringAttributes(product.attributesJson);
    const editorial = await generateProductEditorial({
      title: product.originalTitle || product.title,
      ...(product.originalDescription ? { description: product.originalDescription } : {}),
      ...(attributes ? { attributes } : {}),
      ...(product.categoryId ? { category: product.categoryId } : {}),
      ...(attributes?.BRAND ? { brand: attributes.BRAND } : {}),
      ...(attributes?.MODEL ? { model: attributes.MODEL } : {}),
    });
    await db.product.update({
      where: { id: productId },
      data: {
        displayTitle: editorial.displayTitle,
        shortDescription: editorial.shortDescription,
        description: editorial.description,
        whyWePickedIt: editorial.whyWePickedIt,
        idealFor: editorial.idealFor,
        highlights: editorial.highlights,
        seoTitle: editorial.seoTitle,
        seoDescription: editorial.seoDescription,
        category: editorial.suggestedCategory,
        tags: editorial.suggestedTags,
        aiStatus: 'COMPLETED',
        aiError: null,
      },
    });
    return editorial;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido al generar contenido.';
    await db.product.update({ where: { id: productId }, data: { aiStatus: 'FAILED', aiError: message.slice(0, 1000) } });
    throw error;
  }
}
