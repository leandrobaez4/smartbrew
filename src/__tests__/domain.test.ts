import { describe, it, expect } from 'vitest';
import { GeneratedCopySchema } from '../lib/domain/types';

describe('Domain Logic', () => {
  it('should validate correct GeneratedCopy JSON', () => {
    const validData = {
      hook: 'Este es un gancho que tiene más de 10 caracteres',
      benefits: ['Beneficio 1', 'Beneficio 2', 'Beneficio 3'],
      caption: 'Esta es una descripción larga que supera los 40 caracteres, perfecta para instagram. Nos aseguramos de que cumpla con los requisitos. Producto en el link de la bio.',
      cta: 'Link en bio',
      hashtags: ['#Ejemplo', '#Testeo', '#Prueba'],
      disclaimer: 'Podemos recibir una comisión si comprás a través de nuestro enlace.',
    };

    const result = GeneratedCopySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid GeneratedCopy JSON', () => {
    const invalidData = {
      hook: 'Corto',
      benefits: ['Solo 1'],
      caption: 'Corta',
      cta: 'Ok',
      hashtags: ['#no'],
      disclaimer: 'Corto',
    };

    const result = GeneratedCopySchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
