import { describe, it, expect } from 'vitest';
import { calculateOpportunityScore, ProductScoringInput } from '../lib/domain/scoring';

describe('Scoring Algorithm', () => {
  const baseInput: ProductScoringInput = {
    price: 5000,
    categoryPercentiles: { p35: 6000, p70: 10000 },
    sellerReputation: 'gold',
    hasStock: true,
    hasFastShipping: true,
    salesCount: 100,
    rating: 4.5,
    problemSolvedLevel: 'CLEAR_AND_DAILY',
    problemSolvedDescription: 'Permite apagar un velador desde el celular',
    explanationDifficulty: 'EASY',
    reelHook: 'Convertí cualquier velador en inteligente',
    hasContentPotential: true
  };

  it('should score a perfect product with >= 70 and status SELECTED', () => {
    const result = calculateOpportunityScore(baseInput);
    
    // Price: 25
    // Problem: 25
    // Explanation: 20
    // Trust: 5(rep) + 5(stock) + 5(shipping) + 2(sales) + 3(rating) = 20
    // Content: 10
    // Total: 100
    expect(result.opportunityScore).toBe(100);
    expect(result.priceTier).toBe('LOW');
    expect(result.status).toBe('SELECTED');
    expect(result.selectionReasons).toContain('Precio bajo dentro de su categoría');
    expect(result.selectionReasons).toContain('Beneficio claro y cotidiano');
  });

  it('should discard product if no stock', () => {
    const result = calculateOpportunityScore({ ...baseInput, hasStock: false });
    expect(result.status).toBe('DISCARDED');
    expect(result.opportunityScore).toBe(0);
  });

  it('should put product in manual review if score is between 55 and 69', () => {
    const result = calculateOpportunityScore({
      ...baseInput,
      price: 15000, // HIGH -> 5 pts
      problemSolvedLevel: 'USEFUL_SECONDARY', // 15 pts
      hasContentPotential: false, // 0 pts
      explanationDifficulty: 'MEDIUM' // 10 pts
      // Trust: 20 pts
      // Total: 5 + 15 + 10 + 20 = 50 -> wait, I need 55-69
    });
    
    // Let's adjust to reach 55
    const result2 = calculateOpportunityScore({
      ...baseInput,
      price: 15000, // HIGH -> 5 pts
      problemSolvedLevel: 'CLEAR_AND_DAILY', // 25 pts
      explanationDifficulty: 'MEDIUM', // 10 pts
      hasContentPotential: false, // 0 pts
      // Trust: 20
      // Total: 60
    });
    
    expect(result2.status).toBe('MANUAL_REVIEW');
    expect(result2.opportunityScore).toBe(60);
  });
});
