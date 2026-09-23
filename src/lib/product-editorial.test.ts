import { expect, it } from 'vitest';
import { ProductEditorialSchema, productEditorialPrompt } from './product-editorial';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_SLUGS } from './product-categories';

const valid = {
  displayTitle: 'Cafetera Modelo X de 20 bares',
  shortDescription: 'Cafetera para preparar espresso en casa con los datos informados por el fabricante.',
  description: 'Esta cafetera está pensada para preparar espresso en casa. La ficha informa una presión de 20 bares y un diseño compacto. Su propuesta resulta adecuada para quienes buscan una alternativa doméstica y prefieren revisar las condiciones actualizadas directamente en el marketplace antes de comprar.',
  whyWePickedIt: ['Presión informada de 20 bares', 'Formato pensado para uso doméstico', 'Marca y modelo identificables'],
  idealFor: 'Personas que quieren preparar espresso en casa con un equipo compacto.',
  highlights: ['20 bares de presión', 'Modelo X', 'Uso doméstico'],
  seoTitle: 'Cafetera Modelo X de 20 bares',
  seoDescription: 'Conocé la cafetera Modelo X, sus 20 bares de presión y características informadas para preparar espresso en casa.',
  suggestedCategory: 'cafe',
  suggestedTags: ['cafetera', 'espresso'],
};

it('accepts a complete bounded editorial result', () => {
  expect(ProductEditorialSchema.parse(valid)).toEqual(valid);
});

it('rejects unsupported categories and invented extra fields', () => {
  expect(() => ProductEditorialSchema.parse({ ...valid, suggestedCategory: 'electrodomesticos' })).toThrow();
  expect(() => ProductEditorialSchema.parse({ ...valid, rating: 5 })).toThrow();
});

it.each(PRODUCT_CATEGORY_SLUGS)('accepts the canonical category %s', (suggestedCategory) => {
  expect(ProductEditorialSchema.parse({ ...valid, suggestedCategory }).suggestedCategory).toBe(suggestedCategory);
});

it('builds a prompt that prohibits false claims and lists every canonical category', () => {
  const prompt = productEditorialPrompt({ title: 'Producto real' });
  expect(prompt).toContain('No inventes especificaciones');
  expect(prompt).toContain('No afirmes que SmartBrew probó');
  expect(prompt).toContain('Elegí exactamente una categoría');
  for (const category of PRODUCT_CATEGORIES) {
    expect(prompt).toContain(`- ${category.slug} (${category.name}): ${category.description}`);
  }
  expect(prompt).toContain(`"suggestedCategory": "${PRODUCT_CATEGORY_SLUGS.join(' | ')}"`);
  expect(prompt).toContain('Producto real');
});
