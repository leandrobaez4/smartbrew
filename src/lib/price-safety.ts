export type PriceSafetyConfig = {
  maximumPriceChangePercentage: number;
  minimumPrice: number;
  maximumPrice: number;
};

export type PriceAnomalyReason = 'CHANGE_PERCENTAGE' | 'BELOW_MINIMUM' | 'ABOVE_MAXIMUM';

function nonNegative(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
}

export class PriceSafetyRules {
  constructor(private readonly config: PriceSafetyConfig) {
    nonNegative('maximumPriceChangePercentage', config.maximumPriceChangePercentage);
    nonNegative('minimumPrice', config.minimumPrice);
    nonNegative('maximumPrice', config.maximumPrice);
    if (config.maximumPrice < config.minimumPrice) throw new Error('maximumPrice must be greater than or equal to minimumPrice');
  }

  evaluate(currentPrice: number, proposedPrice: number) {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) throw new Error('currentPrice must be a finite positive number');
    if (!Number.isFinite(proposedPrice) || proposedPrice <= 0) throw new Error('proposedPrice must be a finite positive number');
    const changePercentage = Math.round((Math.abs(proposedPrice - currentPrice) / currentPrice) * 10_000) / 100;
    const reasons: PriceAnomalyReason[] = [];
    if (changePercentage > this.config.maximumPriceChangePercentage) reasons.push('CHANGE_PERCENTAGE');
    if (proposedPrice < this.config.minimumPrice) reasons.push('BELOW_MINIMUM');
    if (proposedPrice > this.config.maximumPrice) reasons.push('ABOVE_MAXIMUM');
    return { safe: reasons.length === 0, changePercentage, reasons };
  }
}
