import { expect, it } from 'vitest';
import { ProductEditorialSchema, productEditorialPrompt } from './product-editorial';

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

it('builds a prompt that explicitly prohibits false reviews and product claims', () => {
  const prompt = productEditorialPrompt({ title: 'Producto real' });
  expect(prompt).toContain('No inventes especificaciones');
  expect(prompt).toContain('No afirmes que SmartBrew probó');
  expect(prompt).toContain('Producto real');
});
