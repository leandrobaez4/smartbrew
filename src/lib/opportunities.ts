import { PricingService } from './pricing';
import { calculateProductScore } from './product-scoring';

export type OpportunityProduct = {
  id: string;
  title: string;
  category: string | null;
  cost: number | null;
  currency: string | null;
  stock: number | null;
  active: boolean;
  editorialTitle?: string | null;
  editorialStatus?: string;
  supplier: { id: string; name: string; status: string; lastSyncAt?: Date | null };
  listings: Array<{ status: string }>;
  history?: Array<{ cost: number | null }>;
  orderCount?: number;
};

export type OpportunityConfig = {
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  extraCosts: number;
  targetMarginPercentage: number;
  minimumMarginPercentage: number;
  minimumProfitAmount: number;
};

export type OpportunityFilters = {
  supplierId?: string;
  category?: string;
  minimumMargin?: number;
  maximumCost?: number;
  minimumStock?: number;
  sort?: 'score' | 'margin' | 'roi' | 'profit' | 'cost';
};

export function calculateOpportunities(
  products: OpportunityProduct[],
  config: OpportunityConfig,
  filters: OpportunityFilters = {},
) {
  const pricing = new PricingService({
    minimumMarginPercentage: config.minimumMarginPercentage,
    minimumProfitAmount: config.minimumProfitAmount,
  });
  const rows = products.flatMap((product) => {
    const cost = product.cost;
    const stock = product.stock ?? 0;
    if (!product.active || product.supplier.status !== 'ACTIVE' || cost == null || cost < 0 || stock <= 0) return [];
    if (filters.supplierId && product.supplier.id !== filters.supplierId) return [];
    if (filters.category && product.category !== filters.category) return [];
    if (filters.maximumCost != null && cost > filters.maximumCost) return [];
    if (filters.minimumStock != null && stock < filters.minimumStock) return [];
    try {
      const result = pricing.calculate({
        supplierCost: cost,
        marketplaceFee: config.marketplaceFee,
        shippingCost: config.shippingCost,
        taxes: config.taxes,
        extraCosts: config.extraCosts,
        targetMarginPercentage: config.targetMarginPercentage,
      });
      if (filters.minimumMargin != null && result.marginPercentage < filters.minimumMargin) return [];
      const productScore = calculateProductScore({
        profitMargin: result.marginPercentage,
        roi: result.roi,
        stock,
        currentCost: cost,
        costHistory: (product.history || []).map((entry) => entry.cost),
        supplierActive: product.supplier.status === 'ACTIVE',
        supplierLastSyncAt: product.supplier.lastSyncAt,
        orderCount: product.orderCount || 0,
      });
      return [{
        ...product,
        cost,
        stock,
        recommendedPrice: result.recommendedPrice,
        estimatedProfit: result.netProfit,
        marginPercentage: result.marginPercentage,
        roi: result.roi,
        productScore: productScore.score,
        scoreFactors: productScore.factors,
        estimatedScoreFactors: productScore.estimatedFactors,
        listingStatus: product.listings[0]?.status || 'NOT_PUBLISHED',
      }];
    } catch {
      return [];
    }
  });
  const sort = filters.sort || 'margin';
  return rows.sort((a, b) => sort === 'cost'
    ? a.cost - b.cost
    : sort === 'score'
      ? b.productScore - a.productScore
    : sort === 'roi'
      ? b.roi - a.roi
      : sort === 'profit'
        ? b.estimatedProfit - a.estimatedProfit
        : b.marginPercentage - a.marginPercentage);
}
