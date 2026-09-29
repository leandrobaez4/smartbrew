import { OrderStatus } from '@prisma/client';
import { orderFinancials } from '@/lib/orders';
import { portalDb, requireAdmin } from '@/lib/portal';
import PurchaseSupplierButton from './PurchaseSupplierButton';
import ManualSupplierPurchaseForm from './ManualSupplierPurchaseForm';
import { getDropshippingSettings } from '@/lib/dropshipping-settings';
import { supplierSnapshotFreshness, supplierSourceUrl } from '@/lib/supplier-snapshot-freshness';

export const dynamic = 'force-dynamic';

function money(value: number, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const labels: Record<OrderStatus, string> = {
  PENDING: 'Compra pendiente',
  SUPPLIER_PENDING: 'Supplier Pending',
  SUPPLIER_PAID: 'Supplier Paid',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  ERROR: 'Supplier Error',
};

export default async function OrdersPage() {
  await requireAdmin();
  const [orders, settings] = await Promise.all([portalDb.order.findMany({
    include: { supplier: true, supplierProduct: true },
    orderBy: { createdAt: 'desc' },
  }), getDropshippingSettings()]);

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-6">
      <p className="text-sm font-semibold text-yellow-600">Dropshipping</p>
      <h1 className="text-3xl font-bold">Órdenes</h1>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Revisá la rentabilidad y el stock antes de comprar al proveedor.</p>
    </div>
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950"><tr>{['Orden ML', 'Producto', 'Proveedor', 'Venta ML', 'Costo proveedor', 'Ganancia', 'Margen', 'Stock', 'Estado', 'Acción'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {orders.map((order) => {
            const salePrice = Number(order.salePrice);
            const supplierCost = Number(order.supplierCost);
            const profit = Number(order.profit);
            const financials = orderFinancials({ salePrice, supplierCost, quantity: order.quantity, profit });
            const unidrop = order.supplier.type === 'unidrop-snapshot-v1';
            const actionable = !unidrop && (order.status === OrderStatus.PENDING || order.status === OrderStatus.ERROR) && !order.supplierOrderId;
            const manualActionable = unidrop && (order.status === OrderStatus.PENDING || order.status === OrderStatus.ERROR) && !order.manualPurchaseCompletedAt;
            const freshness = unidrop ? supplierSnapshotFreshness({ verifiedAt: order.supplierProduct.lastSyncAt, freshHours: settings.snapshotFreshHours, expiredHours: settings.snapshotExpiredHours }) : null;
            const sourceUrl = unidrop ? supplierSourceUrl(order.supplierProduct.rawData) : null;
            const estimatedProfit = salePrice - financials.supplierTotal - Number(order.marketplaceFee) - Number(order.shippingCost) - Number(order.taxes);
            const actualCost = order.actualSupplierCost == null ? null : Number(order.actualSupplierCost);
            const actualProfit = actualCost == null ? null : salePrice - actualCost - Number(order.marketplaceFee) - Number(order.shippingCost) - Number(order.taxes);
            return <tr key={order.id}>
              <td className="px-4 py-3"><p className="font-semibold">{order.marketplaceOrderId}</p><p className="text-xs text-gray-500">{order.quantity} unidad(es)</p></td>
              <td className="px-4 py-3 text-sm"><p>{order.supplierProduct.title}</p><p className="text-xs text-gray-500">SKU {order.supplierProduct.sku || '—'}</p>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Abrir producto en Unidrop</a>}</td>
              <td className="px-4 py-3 text-sm">{order.supplier.name}</td>
              <td className="px-4 py-3 font-semibold">{money(salePrice, order.currency || 'ARS')}</td>
              <td className="px-4 py-3 text-sm"><p>Estimado {money(financials.supplierTotal, order.supplierProduct.currency || order.currency || 'ARS')}</p>{actualCost != null && <p className="font-semibold">Real {money(actualCost, order.currency || 'ARS')}</p>}</td>
              <td className={`px-4 py-3 text-sm font-semibold ${(actualProfit ?? estimatedProfit) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}><p>Estimado {money(estimatedProfit, order.currency || 'ARS')}</p>{actualProfit != null && <p>Real {money(actualProfit, order.currency || 'ARS')}</p>}</td>
              <td className="px-4 py-3 text-sm">{financials.marginPercentage.toFixed(2)}%</td>
              <td className="px-4 py-3 text-sm">{order.supplierProduct.stock ?? '—'}</td>
              <td className="px-4 py-3 text-xs font-semibold"><p>{unidrop && order.status === OrderStatus.PENDING ? 'Compra manual pendiente' : labels[order.status]}</p>{freshness && <p className={freshness.status === 'EXPIRED' ? 'mt-1 text-red-700 dark:text-red-400' : 'mt-1 text-gray-500'}>Snapshot {freshness.status === 'EXPIRED' ? 'vencido' : freshness.status === 'EXPIRING' ? 'por vencer' : freshness.status === 'REVIEW_REQUIRED' ? 'requiere revisión' : 'reciente'}</p>}{order.manualPurchaseError && <p className="mt-1 text-red-700 dark:text-red-400">{order.manualPurchaseError}</p>}</td>
              <td className="px-4 py-3">{manualActionable ? <ManualSupplierPurchaseForm orderId={order.id} estimatedCost={financials.supplierTotal} /> : actionable ? <PurchaseSupplierButton orderId={order.id} /> : <span className="text-xs text-gray-500">{order.manualPurchaseReference || order.supplierOrderId || 'Sin acción pendiente'}</span>}</td>
            </tr>;
          })}
          {!orders.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">Todavía no hay órdenes de Mercado Libre.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
