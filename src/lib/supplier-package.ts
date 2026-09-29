import { z } from 'zod';

const positiveInteger = z.coerce.number().int().positive().max(500_000);

export const SupplierPackageSchema = z.object({
  heightCm: positiveInteger.max(500),
  widthCm: positiveInteger.max(500),
  lengthCm: positiveInteger.max(500),
  weightGrams: positiveInteger,
}).strict();

export type SupplierPackage = z.infer<typeof SupplierPackageSchema>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positive(value: unknown) {
  const parsed = typeof value === 'string' && value.trim()
    ? Number(value.trim().replace(',', '.').match(/^\d+(?:\.\d+)?/)?.[0])
    : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function first(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = positive(source[key]);
    if (value !== undefined) return value;
  }
}

export function supplierPackageDefaults(input: { attributes?: unknown; rawData?: unknown }) {
  const attributes = record(input.attributes);
  const rawData = record(input.rawData);
  const weightGrams = first(attributes, ['weightGrams', 'packageWeightGrams'])
    ?? (() => {
      const kilos = first(attributes, ['weightKg']) ?? first(rawData, ['peso', 'weightKg']);
      return kilos === undefined ? undefined : Math.round(kilos * 1_000);
    })();
  return {
    heightCm: first(attributes, ['packageHeightCm', 'heightCm', 'Alto', 'Altura']) ?? first(rawData, ['alto', 'altura', 'packageHeightCm']),
    widthCm: first(attributes, ['packageWidthCm', 'widthCm', 'Ancho']) ?? first(rawData, ['ancho', 'packageWidthCm']),
    lengthCm: first(attributes, ['packageLengthCm', 'lengthCm', 'Largo', 'Longitud']) ?? first(rawData, ['largo', 'longitud', 'packageLengthCm']),
    weightGrams,
  };
}

export function marketplacePackageAttributes(dimensions: SupplierPackage) {
  return [
    { id: 'SELLER_PACKAGE_HEIGHT', value_name: `${dimensions.heightCm} cm` },
    { id: 'SELLER_PACKAGE_WIDTH', value_name: `${dimensions.widthCm} cm` },
    { id: 'SELLER_PACKAGE_LENGTH', value_name: `${dimensions.lengthCm} cm` },
    { id: 'SELLER_PACKAGE_WEIGHT', value_name: `${dimensions.weightGrams} g` },
  ];
}
