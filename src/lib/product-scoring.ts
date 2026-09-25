export const DEFAULT_PRODUCT_SCORE_WEIGHTS = {
  profitMargin: 20,
  roi: 15,
  stock: 15,
  priceStability: 15,
  supplierStability: 15,
  marketplaceDemand: 10,
  competition: 10,
} as const;

export type ProductScoreWeights = Record<keyof typeof DEFAULT_PRODUCT_SCORE_WEIGHTS, number>;

export type ProductScoreInput = {
  profitMargin: number;
  roi: number;
  stock: number;
  currentCost: number;
  costHistory: Array<number | null>;
  supplierActive: boolean;
  supplierLastSyncAt?: Date | null;
  orderCount: number;
  competitorCount?: number;
};

export type ProductScoreResult = {
  score: number;
  factors: Record<keyof ProductScoreWeights, number>;
  estimatedFactors: Array<keyof ProductScoreWeights>;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function priceStability(currentCost: number, history: Array<number | null>) {
  const values = [...history.filter((value): value is number => value != null && Number.isFinite(value) && value >= 0), currentCost];
  if (values.length < 2) return { value: 50, estimated: true };
  const changes = values.slice(1).map((value, index) => {
    const previous = values[index];
    return previous === 0 ? (value === 0 ? 0 : 100) : Math.abs(value - previous) / previous * 100;
  });
  const averageChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  return { value: clamp(100 - averageChange * 2), estimated: false };
}

export function calculateProductScore(
  input: ProductScoreInput,
  weights: ProductScoreWeights = DEFAULT_PRODUCT_SCORE_WEIGHTS,
): ProductScoreResult {
  const weightTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(weightTotal) || weightTotal <= 0 || Object.values(weights).some((weight) => weight < 0)) {
    throw new Error('Product score weights must be finite, non-negative and have a positive total.');
  }
  const stability = priceStability(input.currentCost, input.costHistory);
  const competitionKnown = input.competitorCount != null;
  const factors: ProductScoreResult['factors'] = {
    profitMargin: clamp(input.profitMargin / 40 * 100),
    roi: clamp(input.roi / 80 * 100),
    stock: clamp(input.stock / 20 * 100),
    priceStability: stability.value,
    supplierStability: input.supplierActive ? (input.supplierLastSyncAt ? 100 : 70) : 0,
    marketplaceDemand: clamp(input.orderCount * 10),
    competition: competitionKnown ? clamp(100 - (input.competitorCount || 0) * 10) : 50,
  };
  const estimatedFactors: ProductScoreResult['estimatedFactors'] = [];
  if (stability.estimated) estimatedFactors.push('priceStability');
  if (!competitionKnown) estimatedFactors.push('competition');
  const weighted = (Object.keys(weights) as Array<keyof ProductScoreWeights>)
    .reduce((sum, factor) => sum + factors[factor] * weights[factor], 0) / weightTotal;
  return { score: Math.round(clamp(weighted)), factors, estimatedFactors };
}
