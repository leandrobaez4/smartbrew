import { describe, expect, it, vi } from 'vitest';
import {
  generateSupplierProductEditorial,
  SupplierProductEditorialSchema,
  supplierProductEditorialPrompt,
} from './supplier-product-editorial';

const editorial = {
  title: 'Auriculares Marca X Modelo Y',
  description: 'Auriculares Marca X Modelo Y con conectividad Bluetooth y autonomía informada de ocho horas por el proveedor.',
  bulletPoints: ['Marca X', 'Modelo Y', 'Conectividad Bluetooth'],
  productHighlights: ['Autonomía informada de ocho horas', 'Color negro'],
  seoKeywords: ['auriculares', 'bluetooth', 'marca x'],
};

describe('supplier product editorial', () => {
  it('accepts the five bounded content fields', () => {
    expect(SupplierProductEditorialSchema.parse(editorial)).toEqual(editorial);
    expect(() => SupplierProductEditorialSchema.parse({ ...editorial, warranty: '12 meses' })).toThrow();
  });

  it('builds a prompt that forbids unsupported product claims', () => {
    const prompt = supplierProductEditorialPrompt({
      supplierTitle: 'Auriculares X',
      supplierDescription: 'Bluetooth',
      attributes: { COLOR: 'Negro' },
    });
    expect(prompt).toContain('No inventes especificaciones');
    expect(prompt).toContain('No completes datos ausentes');
    expect(prompt).toContain('Auriculares X');
    expect(prompt).toContain('COLOR');
  });

  it('parses structured OpenAI output', async () => {
    const openai = {
      chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify(editorial) } }] }) } },
    };
    await expect(generateSupplierProductEditorial({ supplierTitle: 'Auriculares X' }, openai as never)).resolves.toEqual(editorial);
  });

  it('rejects malformed or incomplete provider output', async () => {
    const openai = {
      chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: '{"title":"x"}' } }] }) } },
    };
    await expect(generateSupplierProductEditorial({ supplierTitle: 'Auriculares X' }, openai as never)).rejects.toThrow();
  });
});
