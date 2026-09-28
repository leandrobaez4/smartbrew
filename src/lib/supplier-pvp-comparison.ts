export type SupplierPvpComparison = {
  supplierPvpArs: number;
  publishedPriceArs: number;
  differenceArs: number;
  differencePercentage: number;
  position: 'ABOVE' | 'EQUAL' | 'BELOW';
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function resolveSupplierPvpArs(input: {
  supplierPvpArs?: number | null;
  supplierPvpUsd?: number | null;
  exchangeRateArsPerUsd?: number | null;
}) {
  if (input.supplierPvpArs != null && Number.isFinite(input.supplierPvpArs) && input.supplierPvpArs > 0) {
    return round(input.supplierPvpArs);
  }
  if (
    input.supplierPvpUsd != null
    && input.exchangeRateArsPerUsd != null
    && Number.isFinite(input.supplierPvpUsd)
    && Number.isFinite(input.exchangeRateArsPerUsd)
    && input.supplierPvpUsd > 0
    && input.exchangeRateArsPerUsd > 0
  ) {
    return round(input.supplierPvpUsd * input.exchangeRateArsPerUsd);
  }
  return null;
}

export function compareSupplierPvp(
  supplierPvpArs: number | null | undefined,
  publishedPriceArs: number | null | undefined,
): SupplierPvpComparison | null {
  if (
    supplierPvpArs == null
    || publishedPriceArs == null
    || !Number.isFinite(supplierPvpArs)
    || !Number.isFinite(publishedPriceArs)
    || supplierPvpArs <= 0
    || publishedPriceArs <= 0
  ) return null;

  const differenceArs = round(publishedPriceArs - supplierPvpArs);
  return {
    supplierPvpArs: round(supplierPvpArs),
    publishedPriceArs: round(publishedPriceArs),
    differenceArs,
    differencePercentage: round(differenceArs / supplierPvpArs * 100),
    position: Math.abs(differenceArs) < 0.01 ? 'EQUAL' : differenceArs > 0 ? 'ABOVE' : 'BELOW',
  };
}
