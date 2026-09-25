import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { portalDb } from './portal';

export const dropshippingSettingsDefaults = {
  minimumMargin: 20,
  minimumProfit: 0,
  minimumStock: 1,
  autoPublish: false,
  autoUpdatePrices: false,
  autoPauseNoStock: true,
  autoSupplierPurchase: false,
  priceChangeLimit: 20,
  supplierSyncInterval: 15,
} as const;

export type DropshippingSettings = {
  minimumMargin: number;
  minimumProfit: number;
  minimumStock: number;
  autoPublish: boolean;
  autoUpdatePrices: boolean;
  autoPauseNoStock: boolean;
  autoSupplierPurchase: boolean;
  priceChangeLimit: number;
  supplierSyncInterval: number;
};

const schema = z.object({
  minimumMargin: z.coerce.number().finite().min(0).lt(100),
  minimumProfit: z.coerce.number().finite().min(0).max(1_000_000_000),
  minimumStock: z.coerce.number().int().min(0).max(1_000_000),
  autoPublish: z.boolean(),
  autoUpdatePrices: z.boolean(),
  autoPauseNoStock: z.boolean(),
  autoSupplierPurchase: z.boolean(),
  priceChangeLimit: z.coerce.number().finite().min(0).max(100),
  supplierSyncInterval: z.coerce.number().int().min(1).max(1_440),
});

type SettingsStore = Pick<typeof portalDb, 'dropshippingSettings'>;

function normalized(row: {
  minimumMargin: Prisma.Decimal;
  minimumProfit: Prisma.Decimal;
  minimumStock: number;
  autoPublish: boolean;
  autoUpdatePrices: boolean;
  autoPauseNoStock: boolean;
  autoSupplierPurchase: boolean;
  priceChangeLimit: Prisma.Decimal;
  supplierSyncInterval: number;
}): DropshippingSettings {
  return {
    minimumMargin: Number(row.minimumMargin),
    minimumProfit: Number(row.minimumProfit),
    minimumStock: row.minimumStock,
    autoPublish: row.autoPublish,
    autoUpdatePrices: row.autoUpdatePrices,
    autoPauseNoStock: row.autoPauseNoStock,
    autoSupplierPurchase: row.autoSupplierPurchase,
    priceChangeLimit: Number(row.priceChangeLimit),
    supplierSyncInterval: row.supplierSyncInterval,
  };
}

export async function getDropshippingSettings(store: SettingsStore = portalDb): Promise<DropshippingSettings> {
  const row = await store.dropshippingSettings.findUnique({ where: { id: 'global' } });
  return row ? normalized(row) : { ...dropshippingSettingsDefaults };
}

function checked(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true' || value === '1';
}

export function parseDropshippingSettings(formData: FormData) {
  return schema.safeParse({
    minimumMargin: formData.get('minimumMargin'),
    minimumProfit: formData.get('minimumProfit'),
    minimumStock: formData.get('minimumStock'),
    autoPublish: checked(formData.get('autoPublish')),
    autoUpdatePrices: checked(formData.get('autoUpdatePrices')),
    autoPauseNoStock: checked(formData.get('autoPauseNoStock')),
    autoSupplierPurchase: checked(formData.get('autoSupplierPurchase')),
    priceChangeLimit: formData.get('priceChangeLimit'),
    supplierSyncInterval: formData.get('supplierSyncInterval'),
  });
}

export async function saveDropshippingSettings(settings: DropshippingSettings, store: SettingsStore = portalDb) {
  const parsed = schema.parse(settings);
  const row = await store.dropshippingSettings.upsert({
    where: { id: 'global' },
    create: { id: 'global', ...parsed },
    update: parsed,
  });
  return normalized(row);
}
