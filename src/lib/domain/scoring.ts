export interface ProductScoringInput {
  price: number;
  categoryPercentiles: { p35: number; p70: number };
  sellerReputation: string;
  hasStock: boolean;
  hasFastShipping: boolean;
  salesCount: number;
  rating: number;
  
  // AI Analyzed properties
  problemSolvedLevel: 'CLEAR_AND_DAILY' | 'USEFUL_SECONDARY' | 'ASPIRATIONAL';
  problemSolvedDescription: string;
  explanationDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  reelHook: string;
  hasContentPotential: boolean;
}

export interface ProductScoringResult {
  opportunityScore: number;
  priceTier: 'LOW' | 'MEDIUM' | 'HIGH';
  problemSolved: string;
  reelHook: string;
  explanationDifficulty: string;
  selectionReasons: string[];
  status: 'SELECTED' | 'MANUAL_REVIEW' | 'DISCARDED';
}

export function calculateOpportunityScore(input: ProductScoringInput): ProductScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // Mandatory Discard Rules
  if (!input.hasStock || input.sellerReputation === 'bad' || input.sellerReputation === 'red') {
    return {
      opportunityScore: 0,
      priceTier: 'HIGH',
      problemSolved: input.problemSolvedDescription,
      reelHook: input.reelHook,
      explanationDifficulty: input.explanationDifficulty,
      selectionReasons: ['Descartado: Sin stock o mala reputación del vendedor'],
      status: 'DISCARDED'
    };
  }

  // 1. Price
  let priceTier: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
  if (input.price <= input.categoryPercentiles.p35) {
    score += 25;
    priceTier = 'LOW';
    reasons.push('Precio bajo dentro de su categoría');
  } else if (input.price <= input.categoryPercentiles.p70) {
    score += 18;
    priceTier = 'MEDIUM';
    reasons.push('Precio accesible en su categoría');
  } else {
    score += 5;
    reasons.push('Precio alto en su categoría');
  }

  // 2. Problem Solved
  if (input.problemSolvedLevel === 'CLEAR_AND_DAILY') {
    score += 25;
    reasons.push('Beneficio claro y cotidiano');
  } else if (input.problemSolvedLevel === 'USEFUL_SECONDARY') {
    score += 15;
    reasons.push('Beneficio útil');
  } else {
    score += 5;
  }

  // 3. Explanation Difficulty
  if (input.explanationDifficulty === 'EASY') {
    score += 20;
    reasons.push('Fácil de explicar visualmente');
  } else if (input.explanationDifficulty === 'MEDIUM') {
    score += 10;
  }

  // 4. Trust
  if (['gold', 'platinum', 'green', 'good'].includes(input.sellerReputation)) {
    score += 5;
    reasons.push('Vendedor con buena reputación');
  }
  if (input.hasStock) score += 5;
  if (input.hasFastShipping) {
    score += 5;
    reasons.push('Envío competitivo');
  }
  if (input.salesCount > 50) score += 2;
  if (input.rating >= 4.0) score += 3;

  // 5. Content Potential
  if (input.hasContentPotential) {
    score += 10;
    reasons.push('Alto potencial para Reel');
  }

  // Status mapping
  let status: 'SELECTED' | 'MANUAL_REVIEW' | 'DISCARDED' = 'DISCARDED';
  if (score >= 70) {
    status = 'SELECTED';
  } else if (score >= 55) {
    status = 'MANUAL_REVIEW';
  }

  return {
    opportunityScore: score,
    priceTier,
    problemSolved: input.problemSolvedDescription,
    reelHook: input.reelHook,
    explanationDifficulty: input.explanationDifficulty,
    selectionReasons: reasons,
    status
  };
}
