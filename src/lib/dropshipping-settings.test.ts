import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  dropshippingSettingsDefaults,
  getDropshippingSettings,
  parseDropshippingSettings,
  saveDropshippingSettings,
} from './dropshipping-settings';

describe('dropshipping settings', () => {
  it('returns safe defaults without creating a database row', async () => {
    const store = { dropshippingSettings: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(getDropshippingSettings(store as never)).resolves.toEqual(dropshippingSettingsDefaults);
  });

  it('validates editable form values and treats absent checkboxes as disabled', () => {
    const form = new FormData();
    form.set('minimumMargin', '25');
    form.set('minimumProfit', '1000');
    form.set('minimumStock', '2');
    form.set('priceChangeLimit', '15');
    form.set('supplierSyncInterval', '10');
    form.set('autoPauseNoStock', 'on');
    expect(parseDropshippingSettings(form)).toMatchObject({
      success: true,
      data: {
        minimumMargin: 25,
        minimumProfit: 1000,
        minimumStock: 2,
        autoPublish: false,
        autoUpdatePrices: false,
        autoPauseNoStock: true,
        autoSupplierPurchase: false,
        priceChangeLimit: 15,
        supplierSyncInterval: 10,
      },
    });
  });

  it('rejects unsafe ranges', () => {
    const form = new FormData();
    form.set('minimumMargin', '100');
    form.set('minimumProfit', '0');
    form.set('minimumStock', '-1');
    form.set('priceChangeLimit', '200');
    form.set('supplierSyncInterval', '0');
    expect(parseDropshippingSettings(form).success).toBe(false);
  });

  it('persists a validated singleton and normalizes decimals', async () => {
    const row = {
      id: 'global', ...dropshippingSettingsDefaults,
      minimumMargin: new Prisma.Decimal(20), minimumProfit: new Prisma.Decimal(0),
      priceChangeLimit: new Prisma.Decimal(20), createdAt: new Date(0), updatedAt: new Date(0),
    };
    const store = { dropshippingSettings: { upsert: vi.fn().mockResolvedValue(row) } };
    await expect(saveDropshippingSettings({ ...dropshippingSettingsDefaults }, store as never)).resolves.toEqual(dropshippingSettingsDefaults);
    expect(store.dropshippingSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'global' } }));
  });
});
