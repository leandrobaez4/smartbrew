import { ProfitabilityResult, ProfitabilityService } from './profitability';

export type PricingInput = {
  supplierCost: number;
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  extraCosts: number;
  targetMarginPercentage: number;
};

export type PricingConfig = {
  minimumMarginPercentage: number;
  minimumProfitAmount?: number;
};

export type PricingResult = Pick<ProfitabilityResult, 'netProfit' | 'marginPercentage' | 'roi'> & {
  recommendedPrice: number;
  appliedMarginPercentage: number;
};

function validatePercentage(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 100) {
    throw new Error(`${name} must be a finite percentage between 0 and 100`);
  }
}

export class PricingService {
  private readonly minimumProfitAmount: number;

  constructor(private readonly config: PricingConfig) {
    validatePercentage('minimumMarginPercentage', config.minimumMarginPercentage);
    this.minimumProfitAmount = config.minimumProfitAmount ?? 0;
    if (!Number.isFinite(this.minimumProfitAmount) || this.minimumProfitAmount < 0) {
      throw new Error('minimumProfitAmount must be a finite non-negative number');
    }
  }

  calculate(input: PricingInput): PricingResult {
    validatePercentage('targetMarginPercentage', input.targetMarginPercentage);
    const appliedMarginPercentage = Math.max(
      input.targetMarginPercentage,
      this.config.minimumMarginPercentage,
    );
    const profitability = new ProfitabilityService({
      minimumProfitPercentage: appliedMarginPercentage,
      minimumProfitAmount: this.minimumProfitAmount,
    });
    const costs = input.supplierCost + input.marketplaceFee + input.shippingCost + input.taxes + input.extraCosts;
    const baseInput = {
      supplierCost: input.supplierCost,
      marketplaceFee: input.marketplaceFee,
      shippingCost: input.shippingCost,
      taxes: input.taxes,
      extraCosts: input.extraCosts,
    };
    const recommendation = profitability.calculate({
      ...baseInput,
      marketplacePrice: Math.max(costs, 0.01),
    });
    let recommendedPrice = recommendation.recommendedPrice;
    let result = profitability.calculate({ ...baseInput, marketplacePrice: recommendedPrice });

    // Currency rounding must never leave the final price one cent below the configured threshold.
    if (!result.meetsMinimumProfitability) {
      recommendedPrice = Math.round((recommendedPrice + 0.01) * 100) / 100;
      result = profitability.calculate({ ...baseInput, marketplacePrice: recommendedPrice });
    }
    if (result.netProfit < 0 || !result.meetsMinimumProfitability) {
      throw new Error('Unable to calculate a profitable marketplace price');
    }

    return {
      recommendedPrice,
      appliedMarginPercentage,
      netProfit: result.netProfit,
      marginPercentage: result.marginPercentage,
      roi: result.roi,
    };
  }
}
