import { describe, expect, it } from 'vitest';
import { marketplacePackageAttributes, supplierPackageDefaults, SupplierPackageSchema } from './supplier-package';

describe('supplier package', () => {
  it('uses Elit weight in kilograms and available package dimensions', () => {
    expect(supplierPackageDefaults({
      attributes: { weightKg: 0.76 },
      rawData: { alto: 8, ancho: 18, largo: 22 },
    })).toEqual({ heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 });
  });

  it('reads dimensions exposed as Spanish supplier attributes', () => {
    expect(supplierPackageDefaults({
      attributes: { weightKg: 1.2, Alto: '10 cm', Ancho: '20 cm', Largo: '30 cm' },
    })).toEqual({ heightCm: 10, widthCm: 20, lengthCm: 30, weightGrams: 1_200 });
  });

  it('validates integer package measurements and formats marketplace attributes', () => {
    const dimensions = SupplierPackageSchema.parse({ heightCm: '8', widthCm: 18, lengthCm: 22, weightGrams: 760 });
    expect(marketplacePackageAttributes(dimensions)).toEqual([
      { id: 'SELLER_PACKAGE_HEIGHT', value_name: '8 cm' },
      { id: 'SELLER_PACKAGE_WIDTH', value_name: '18 cm' },
      { id: 'SELLER_PACKAGE_LENGTH', value_name: '22 cm' },
      { id: 'SELLER_PACKAGE_WEIGHT', value_name: '760 g' },
    ]);
    expect(SupplierPackageSchema.safeParse({ ...dimensions, weightGrams: 0 }).success).toBe(false);
  });
});
