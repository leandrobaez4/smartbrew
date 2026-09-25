import { AlertType, Prisma } from '@prisma/client';
import { portalDb } from './portal';

type AlertInput = {
  type: AlertType;
  origin: string;
  entityType?: string;
  entityId?: string;
  message: string;
  details?: Prisma.InputJsonValue;
};

type AlertStore = Pick<typeof portalDb, 'alert'>;

const alertSources: Partial<Record<string, AlertType>> = {
  SUPPLIER_OUT_OF_STOCK: AlertType.SUPPLIER_OUT_OF_STOCK,
  SUPPLIER_PRICE_INCREASE: AlertType.SUPPLIER_PRICE_INCREASE,
  LOW_MARGIN: AlertType.LOW_MARGIN,
  PRICE_ANOMALY: AlertType.PRICE_ANOMALY,
};

function record(details: unknown): Record<string, unknown> {
  return details && !Array.isArray(details) && typeof details === 'object'
    ? details as Record<string, unknown>
    : {};
}

function relatedEntity(details: unknown) {
  const value = record(details);
  const candidates = [
    ['Order', value.orderId],
    ['MarketplaceListing', value.listingId],
    ['SupplierProduct', value.supplierProductId],
    ['Supplier', value.supplierId],
  ] as const;
  const entity = candidates.find(([, id]) => typeof id === 'string' && id.length > 0);
  return entity ? { entityType: entity[0], entityId: entity[1] as string } : {};
}

export function alertFromSystemEvent(
  level: 'INFO' | 'WARN' | 'ERROR',
  source: string,
  message: string,
  details?: unknown,
): AlertInput | null {
  let type = alertSources[source];
  if (!type && level === 'ERROR') {
    if (source === 'supplier_sync' || source === 'supplier_integration' || source === 'supplier_order_status_sync') type = AlertType.SUPPLIER_API_ERROR;
    else if (source === 'supplier_order') type = AlertType.ORDER_CREATION_ERROR;
    else if (source.startsWith('marketplace_') || source.startsWith('mercado_libre_')) type = AlertType.MARKETPLACE_SYNC_ERROR;
  }
  if (!type) return null;
  return {
    type,
    origin: source,
    ...relatedEntity(details),
    message,
    details: details == null ? undefined : JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue,
  };
}

export async function createAlert(input: AlertInput, store: AlertStore = portalDb) {
  return store.alert.create({ data: input });
}

export async function persistAlertFromSystemEvent(
  level: 'INFO' | 'WARN' | 'ERROR',
  source: string,
  message: string,
  details?: unknown,
  store: AlertStore = portalDb,
) {
  const alert = alertFromSystemEvent(level, source, message, details);
  return alert ? createAlert(alert, store) : null;
}
