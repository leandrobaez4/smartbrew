export type ProfitabilityInput = {
  supplierCost: number;
  marketplacePrice: number;
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  extraCosts: number;
};

export type ProfitabilityConfig = {
  minimumProfitPercentage: number;
  minimumProfitAmount: number;
};

export type ProfitabilityResult = {
  grossProfit: number;
  netProfit: number;
  marginPercentage: number;
  roi: number;
  recommendedPrice: number;
  meetsMinimumProfitability: boolean;
};

function finiteNonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundUp(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.ceil((value - Number.EPSILON) * factor) / factor;
}

export class ProfitabilityService {
  constructor(private readonly config: ProfitabilityConfig) {
    finiteNonNegative('minimumProfitPercentage', config.minimumProfitPercentage);
    finiteNonNegative('minimumProfitAmount', config.minimumProfitAmount);
    if (config.minimumProfitPercentage >= 100) {
      throw new Error('minimumProfitPercentage must be lower than 100');
    }
  }

  calculate(input: ProfitabilityInput): ProfitabilityResult {
    for (const [name, value] of Object.entries(input)) finiteNonNegative(name, value);
    if (input.marketplacePrice === 0) throw new Error('marketplacePrice must be greater than zero');

    const operatingCosts = input.marketplaceFee + input.shippingCost + input.taxes + input.extraCosts;
    const totalCosts = input.supplierCost + operatingCosts;
    const grossProfit = input.marketplacePrice - input.supplierCost;
    const netProfit = input.marketplacePrice - totalCosts;
    const marginPercentage = (netProfit / input.marketplacePrice) * 100;
    const roi = totalCosts === 0 ? 0 : (netProfit / totalCosts) * 100;
    const amountPrice = totalCosts + this.config.minimumProfitAmount;
    const percentagePrice = totalCosts / (1 - this.config.minimumProfitPercentage / 100);
    const recommendedPrice = Math.max(amountPrice, percentagePrice);
    const meetsMinimumProfitability = netProfit >= this.config.minimumProfitAmount
      && marginPercentage >= this.config.minimumProfitPercentage;

    return {
      grossProfit: round(grossProfit),
      netProfit: round(netProfit),
      marginPercentage: round(marginPercentage),
      roi: round(roi),
      recommendedPrice: roundUp(recommendedPrice),
      meetsMinimumProfitability,
    };
  }
}
