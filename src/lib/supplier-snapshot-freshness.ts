export type SupplierSnapshotFreshness = 'RECENT' | 'EXPIRING' | 'EXPIRED' | 'REVIEW_REQUIRED';

export type SupplierSnapshotFreshnessResult = {
  status: SupplierSnapshotFreshness;
  ageHours: number;
  canPublish: boolean;
  recommendation: string;
};

export function supplierSnapshotFreshness(input: {
  verifiedAt: Date;
  marketplaceSyncedAt?: Date | null;
  listingStatus?: string | null;
  stock?: number | null;
  freshHours: number;
  expiredHours: number;
  now?: Date;
}): SupplierSnapshotFreshnessResult {
  const now = input.now || new Date();
  const ageHours = Math.max(0, (now.getTime() - input.verifiedAt.getTime()) / 3_600_000);
  if (ageHours >= input.expiredHours) {
    return {
      status: 'EXPIRED',
      ageHours,
      canPublish: false,
      recommendation: 'Verificá nuevamente precio y stock en Unidrop antes de publicar.',
    };
  }
  const changedAfterMarketplaceSync = Boolean(
    input.marketplaceSyncedAt && input.verifiedAt.getTime() > input.marketplaceSyncedAt.getTime(),
  );
  if (changedAfterMarketplaceSync) {
    const pause = (input.stock ?? 0) <= 0 && input.listingStatus === 'ACTIVE';
    return {
      status: 'REVIEW_REQUIRED',
      ageHours,
      canPublish: true,
      recommendation: pause
        ? 'El snapshot no tiene stock: revisá y confirmá si corresponde pausar Mercado Libre.'
        : 'El snapshot es posterior a la sincronización de Mercado Libre: revisá costo y stock antes de actualizar.',
    };
  }
  if (ageHours >= input.freshHours) {
    return {
      status: 'EXPIRING',
      ageHours,
      canPublish: true,
      recommendation: 'El snapshot está por vencer; conviene verificarlo antes de operar.',
    };
  }
  return {
    status: 'RECENT',
    ageHours,
    canPublish: true,
    recommendation: 'Precio y stock fueron verificados recientemente.',
  };
}

export function supplierSourceUrl(rawData: unknown) {
  if (!rawData || Array.isArray(rawData) || typeof rawData !== 'object') return null;
  const sourceUrl = (rawData as Record<string, unknown>).sourceUrl;
  if (typeof sourceUrl !== 'string') return null;
  try {
    const url = new URL(sourceUrl);
    return url.protocol === 'https:' && url.hostname === 'www.unidrop.com.ar' ? url.href : null;
  } catch {
    return null;
  }
}
