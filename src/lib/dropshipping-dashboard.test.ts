import { describe, expect, it } from 'vitest';
import { dashboardPeriodStart, parseDashboardPeriod, summarizeOrderFinancials } from './dropshipping-dashboard';

describe('dropshipping dashboard', () => {
  it('accepts only supported periods and defaults safely to 30 days', () => {
    expect(parseDashboardPeriod('7')).toBe(7);
    expect(parseDashboardPeriod('90')).toBe(90);
    expect(parseDashboardPeriod('0')).toBe(30);
    expect(parseDashboardPeriod('all')).toBe(30);
  });

  it('calculates an exact UTC-safe rolling period', () => {
    const now = new Date('2026-09-24T21:00:00.000Z');
    expect(dashboardPeriodStart(7, now).toISOString()).toBe('2026-09-17T21:00:00.000Z');
  });

  it('summarizes revenue, profit and average order margin', () => {
    expect(summarizeOrderFinancials([
      { salePrice: 10_000, profit: 2_000 },
      { salePrice: 20_000, profit: 2_000 },
    ])).toEqual({ revenue: 30_000, estimatedProfit: 4_000, averageMargin: 15 });
    expect(summarizeOrderFinancials([])).toEqual({ revenue: 0, estimatedProfit: 0, averageMargin: 0 });
  });
});
