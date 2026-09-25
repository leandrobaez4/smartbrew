import { OrderStatus, Prisma, Supplier, SupplierProduct } from '@prisma/client';
import { dropshippingDryRunEnabled, logDryRunAction } from './dropshipping-dry-run';
import { getDropshippingSettings } from './dropshipping-settings';
import { logSystemEvent } from './logger';
import { portalDb } from './portal';
import { SupplierConnectorFactory } from './suppliers/connectors';
import { supplierConnectorConfig, supplierConnectorFactory } from './suppliers/sync';

type SupplierOrderRecord = {
  id: string;
  marketplaceOrderId: string;
  quantity: number;
  shippingData: Prisma.JsonValue;
  status: OrderStatus;
  supplierOrderId: string | null;
  supplier: Supplier;
  supplierProduct: SupplierProduct;
};

type SupplierOrderDependencies = {
  findOrder?: (id: string) => Promise<SupplierOrderRecord | null>;
  claimOrder?: (id: string) => Promise<boolean>;
  saveSuccess?: (id: string, externalOrderId: string, response: Prisma.InputJsonValue, status: OrderStatus) => Promise<unknown>;
  saveFailure?: (id: string) => Promise<unknown>;
  factory?: SupplierConnectorFactory;
  logger?: typeof logSystemEvent;
  automatic?: boolean;
  dryRun?: boolean;
};

export function automaticSupplierOrderingEnabled(value = process.env.AUTOMATIC_SUPPLIER_ORDERING) {
  if (value == null || value.trim() === '') return false;
  if (['true', '1', 'on'].includes(value.trim().toLowerCase())) return true;
  if (['false', '0', 'off'].includes(value.trim().toLowerCase())) return false;
  throw new Error('AUTOMATIC_SUPPLIER_ORDERING must be ON or OFF');
}

function shippingAddress(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return undefined;
  const root = value as Record<string, Prisma.JsonValue>;
  const address = root.receiver_address && !Array.isArray(root.receiver_address) && typeof root.receiver_address === 'object'
    ? root.receiver_address as Record<string, Prisma.JsonValue>
    : root;
  const result = Object.fromEntries(Object.entries(address).flatMap(([key, raw]) => (
    typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
      ? [[key, String(raw)]]
      : []
  )));
  return Object.keys(result).length ? result : undefined;
}

export async function createSupplierOrder(orderId: string, dependencies: SupplierOrderDependencies = {}) {
  const automatic = dependencies.automatic
    ?? (await getDropshippingSettings()).autoSupplierPurchase;
  if (!automatic) return { status: 'disabled' as const };
  const findOrder = dependencies.findOrder || ((id) => portalDb.order.findUnique({
    where: { id }, include: { supplier: true, supplierProduct: true },
  }));
  const claimOrder = dependencies.claimOrder || (async (id) => (await portalDb.order.updateMany({
    where: { id, status: { in: [OrderStatus.PENDING, OrderStatus.ERROR] }, supplierOrderId: null },
    data: { status: OrderStatus.SUPPLIER_PENDING },
  })).count === 1);
  const saveSuccess = dependencies.saveSuccess || ((id, externalOrderId, response, status) => portalDb.order.update({
    where: { id },
    data: { supplierOrderId: externalOrderId, supplierResponse: response, status },
  }));
  const saveFailure = dependencies.saveFailure || ((id) => portalDb.order.update({
    where: { id }, data: { status: OrderStatus.ERROR },
  }));
  const logger = dependencies.logger || logSystemEvent;
  const order = await findOrder(orderId);
  if (!order) throw new Error('No existe la orden.');
  if (order.supplierOrderId) return { status: 'duplicate' as const, externalOrderId: order.supplierOrderId };
  if (dependencies.dryRun ?? dropshippingDryRunEnabled()) {
    await logDryRunAction('supplier_order_create', {
      orderId: order.id,
      supplierId: order.supplier.id,
      supplierProductId: order.supplierProduct.id,
      quantity: order.quantity,
      reference: order.marketplaceOrderId,
    }, logger);
    return { status: 'simulated' as const };
  }
  if (!await claimOrder(order.id)) return { status: 'in_progress' as const };

  try {
    const connector = (dependencies.factory || supplierConnectorFactory).make(supplierConnectorConfig(order.supplier));
    const response = await connector.createOrder({
      reference: order.marketplaceOrderId,
      items: [{ externalId: order.supplierProduct.externalId, quantity: order.quantity }],
      shippingAddress: shippingAddress(order.shippingData),
    });
    if (!response.externalOrderId.trim()) throw new Error('El proveedor devolvió una orden sin ID.');
    const status = response.status.toLowerCase() === 'paid' ? OrderStatus.SUPPLIER_PAID : OrderStatus.SUPPLIER_PENDING;
    await saveSuccess(order.id, response.externalOrderId, response as unknown as Prisma.InputJsonValue, status);
    await logger('INFO', 'supplier_order', 'Supplier order created', {
      orderId: order.id,
      supplierId: order.supplier.id,
      externalOrderId: response.externalOrderId,
    });
    return { status: 'created' as const, externalOrderId: response.externalOrderId };
  } catch (error) {
    await saveFailure(order.id);
    await logger('ERROR', 'supplier_order', 'Supplier order creation failed', {
      orderId: order.id,
      supplierId: order.supplier.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
