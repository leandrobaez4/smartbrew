import { OrderStatus, Supplier } from '@prisma/client';
import { logSystemEvent } from './logger';
import { portalDb } from './portal';
import { SupplierConnectorFactory } from './suppliers/connectors';
import { supplierConnectorConfig, supplierConnectorFactory } from './suppliers/sync';

type TrackedSupplierOrder = {
  id: string;
  supplierOrderId: string | null;
  status: OrderStatus;
  supplier: Supplier;
};

type StatusSyncDependencies = {
  findOrders?: () => Promise<TrackedSupplierOrder[]>;
  updateOrder?: (id: string, status: OrderStatus) => Promise<unknown>;
  factory?: SupplierConnectorFactory;
  logger?: typeof logSystemEvent;
};

export type SupplierOrderStatusSyncResult = {
  inspected: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export function normalizeSupplierOrderStatus(status: string): OrderStatus {
  switch (status.trim().toLowerCase()) {
    case 'pending':
      return OrderStatus.SUPPLIER_PENDING;
    case 'paid':
      return OrderStatus.SUPPLIER_PAID;
    case 'processing':
    case 'ready':
    case 'ready_to_ship':
      return OrderStatus.PROCESSING;
    case 'shipped':
    case 'in_transit':
      return OrderStatus.SHIPPED;
    case 'delivered':
      return OrderStatus.DELIVERED;
    case 'cancelled':
    case 'canceled':
      return OrderStatus.CANCELLED;
    default:
      throw new Error('Estado de orden del proveedor desconocido.');
  }
}

export async function syncSupplierOrderStatuses(
  dependencies: StatusSyncDependencies = {},
): Promise<SupplierOrderStatusSyncResult> {
  const findOrders = dependencies.findOrders || (() => portalDb.order.findMany({
    where: {
      supplierOrderId: { not: null },
      status: { in: [OrderStatus.SUPPLIER_PENDING, OrderStatus.SUPPLIER_PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
    },
    select: { id: true, supplierOrderId: true, status: true, supplier: true },
    orderBy: { updatedAt: 'asc' },
  }));
  const updateOrder = dependencies.updateOrder || ((id, status) => portalDb.order.update({
    where: { id }, data: { status },
  }));
  const factory = dependencies.factory || supplierConnectorFactory;
  const logger = dependencies.logger || logSystemEvent;
  const orders = await findOrders();
  const result: SupplierOrderStatusSyncResult = { inspected: orders.length, updated: 0, unchanged: 0, failed: 0 };

  for (const order of orders) {
    try {
      if (!order.supplierOrderId) throw new Error('La orden no tiene ID del proveedor.');
      const response = await factory.make(supplierConnectorConfig(order.supplier)).getOrderStatus(order.supplierOrderId);
      if (response.externalOrderId !== order.supplierOrderId) throw new Error('El proveedor devolvió un ID de orden diferente.');
      const normalized = normalizeSupplierOrderStatus(response.status);
      if (normalized === order.status) {
        result.unchanged += 1;
        continue;
      }
      await updateOrder(order.id, normalized);
      result.updated += 1;
      await logger('INFO', 'supplier_order_status_sync', 'Supplier order status updated', {
        orderId: order.id,
        supplierId: order.supplier.id,
        externalOrderId: order.supplierOrderId,
        previousStatus: order.status,
        status: normalized,
      });
    } catch (error) {
      result.failed += 1;
      await logger('ERROR', 'supplier_order_status_sync', 'Supplier order status synchronization failed', {
        orderId: order.id,
        supplierId: order.supplier.id,
        externalOrderId: order.supplierOrderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  await logger(result.failed ? 'WARN' : 'INFO', 'supplier_order_status_sync', 'Supplier order status synchronization completed', result);
  return result;
}
