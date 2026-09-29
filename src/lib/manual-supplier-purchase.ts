import { OrderStatus, Prisma } from '@prisma/client';
import { logSystemEvent } from './logger';
import { portalDb } from './portal';

type ManualPurchaseOrder = {
  id: string;
  salePrice: Prisma.Decimal;
  supplierCost: Prisma.Decimal;
  marketplaceFee: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
  taxes: Prisma.Decimal;
  quantity: number;
  supplier: { id: string; type: string | null };
  supplierProduct: { id: string; sku: string | null };
};

type Dependencies = {
  findOrder?: (id: string) => Promise<ManualPurchaseOrder | null>;
  updateOrder?: (id: string, data: Prisma.OrderUpdateInput) => Promise<unknown>;
  logger?: typeof logSystemEvent;
  now?: Date;
};

export type ManualPurchaseInput =
  | { action: 'complete'; reference: string; actualCost: number }
  | { action: 'error'; error: string };

export async function resolveManualSupplierPurchase(orderId: string, input: ManualPurchaseInput, dependencies: Dependencies = {}) {
  const findOrder = dependencies.findOrder || ((id) => portalDb.order.findUnique({
    where: { id },
    include: { supplier: true, supplierProduct: true },
  }));
  const updateOrder = dependencies.updateOrder || ((id, data) => portalDb.order.update({ where: { id }, data }));
  const logger = dependencies.logger || logSystemEvent;
  const now = dependencies.now || new Date();
  const order = await findOrder(orderId);
  if (!order) throw new Error('No existe la orden.');
  if (order.supplier.type !== 'unidrop-snapshot-v1') throw new Error('La orden no corresponde a una compra manual de Unidrop.');

  if (input.action === 'complete') {
    const reference = input.reference.trim();
    if (!reference || reference.length > 160) throw new Error('Ingresá una referencia de compra válida.');
    if (!Number.isFinite(input.actualCost) || input.actualCost < 0 || input.actualCost > 1_000_000_000) {
      throw new Error('Ingresá un costo real válido.');
    }
    const actualProfit = Number(order.salePrice) - input.actualCost - Number(order.marketplaceFee) - Number(order.shippingCost) - Number(order.taxes);
    await updateOrder(order.id, {
      actualSupplierCost: new Prisma.Decimal(input.actualCost),
      manualPurchaseReference: reference,
      manualPurchaseError: null,
      manualPurchaseCompletedAt: now,
      manualPurchaseUpdatedAt: now,
      profit: new Prisma.Decimal(Math.round(actualProfit * 100) / 100),
      financialsEstimated: false,
      status: OrderStatus.SUPPLIER_PAID,
    });
    await logger('INFO', 'manual_supplier_purchase', 'Manual Unidrop purchase completed', {
      orderId: order.id,
      supplierId: order.supplier.id,
      supplierProductId: order.supplierProduct.id,
      sku: order.supplierProduct.sku,
      reference,
      estimatedCost: Number(order.supplierCost) * order.quantity,
      actualCost: input.actualCost,
    });
    return { status: 'completed' as const, actualProfit: Math.round(actualProfit * 100) / 100 };
  }

  const error = input.error.trim();
  if (!error || error.length > 500) throw new Error('Describí el error de la compra manual.');
  await updateOrder(order.id, {
    manualPurchaseError: error,
    manualPurchaseUpdatedAt: now,
    status: OrderStatus.ERROR,
  });
  await logger('WARN', 'manual_supplier_purchase', 'Manual Unidrop purchase marked as error', {
    orderId: order.id,
    supplierId: order.supplier.id,
    supplierProductId: order.supplierProduct.id,
    sku: order.supplierProduct.sku,
    error,
  });
  return { status: 'error' as const };
}
