import { describe, expect, it, vi } from 'vitest';
import { dropshippingDryRunEnabled, logDryRunAction } from './dropshipping-dry-run';

describe('dropshipping dry run', () => {
  it.each(['true', 'TRUE', '1', 'on'])('enables dry run for %s', (value) => {
    expect(dropshippingDryRunEnabled(value)).toBe(true);
  });

  it.each([undefined, '', 'false', '0', 'off'])('keeps dry run disabled for %s', (value) => {
    expect(dropshippingDryRunEnabled(value)).toBe(false);
  });

  it('rejects ambiguous configuration values', () => {
    expect(() => dropshippingDryRunEnabled('yes')).toThrow('DROPSHIPPING_DRY_RUN');
  });

  it('logs only the curated simulation metadata supplied by the caller', async () => {
    const logger = vi.fn().mockResolvedValue(undefined);
    await logDryRunAction('marketplace_publish', { supplierProductId: 'product-1', price: 120 }, logger);
    expect(logger).toHaveBeenCalledWith('INFO', 'dropshipping_dry_run', 'Dry run: marketplace_publish', {
      operation: 'marketplace_publish', supplierProductId: 'product-1', price: 120,
    });
  });
});
