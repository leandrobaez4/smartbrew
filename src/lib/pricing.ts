import { ProfitabilityResult, ProfitabilityService } from './profitability';

export type PricingInput = {
  supplierCost: number;
  marketplaceFee: number;
  marketplaceFeePercentage?: number;
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
  marketplaceFeeAmount: number;
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
    const marketplaceFeePercentage = input.marketplaceFeePercentage ?? 0;
    validatePercentage('marketplaceFeePercentage', marketplaceFeePercentage);
    const appliedMarginPercentage = Math.max(
      input.targetMarginPercentage,
      this.config.minimumMarginPercentage,
    );
    if (appliedMarginPercentage + marketplaceFeePercentage >= 100) {
      throw new Error('The target margin and marketplace fee must add up to less than 100 percent');
    }
    const profitability = new ProfitabilityService({
      minimumProfitPercentage: appliedMarginPercentage,
      minimumProfitAmount: this.minimumProfitAmount,
    });
    const costs = input.supplierCost + input.marketplaceFee + input.shippingCost + input.taxes + input.extraCosts;
    const percentageFeeRate = marketplaceFeePercentage / 100;
    const baseInput = {
      supplierCost: input.supplierCost,
      marketplaceFee: input.marketplaceFee,
      shippingCost: input.shippingCost,
      taxes: input.taxes,
      extraCosts: input.extraCosts,
    };
    const marginRate = appliedMarginPercentage / 100;
    const priceForMargin = costs / (1 - percentageFeeRate - marginRate);
    const priceForMinimumProfit = (costs + this.minimumProfitAmount) / (1 - percentageFeeRate);
    let recommendedPrice = Math.ceil((Math.max(priceForMargin, priceForMinimumProfit) - Number.EPSILON) * 100) / 100;
    let marketplaceFeeAmount = input.marketplaceFee + recommendedPrice * percentageFeeRate;
    let result = profitability.calculate({ ...baseInput, marketplaceFee: marketplaceFeeAmount, marketplacePrice: recommendedPrice });

    // Currency rounding must never leave the final price one cent below the configured threshold.
    if (!result.meetsMinimumProfitability) {
      recommendedPrice = Math.round((recommendedPrice + 0.01) * 100) / 100;
      marketplaceFeeAmount = input.marketplaceFee + recommendedPrice * percentageFeeRate;
      result = profitability.calculate({ ...baseInput, marketplaceFee: marketplaceFeeAmount, marketplacePrice: recommendedPrice });
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
      marketplaceFeeAmount: Math.round((marketplaceFeeAmount + Number.EPSILON) * 100) / 100,
    };
  }
}
