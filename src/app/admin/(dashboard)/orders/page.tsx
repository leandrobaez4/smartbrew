import { OrderStatus } from '@prisma/client';
import { orderFinancials } from '@/lib/orders';
import { portalDb, requireAdmin } from '@/lib/portal';
import PurchaseSupplierButton from './PurchaseSupplierButton';

export const dynamic = 'force-dynamic';

function money(value: number, currency = 'ARS') {
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const labels: Record<OrderStatus, string> = {
  PENDING: 'Awaiting Supplier Purchase',
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
  const orders = await portalDb.order.findMany({
    include: { supplier: true, supplierProduct: true },
    orderBy: { createdAt: 'desc' },
  });

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
            const actionable = (order.status === OrderStatus.PENDING || order.status === OrderStatus.ERROR) && !order.supplierOrderId;
            return <tr key={order.id}>
              <td className="px-4 py-3"><p className="font-semibold">{order.marketplaceOrderId}</p><p className="text-xs text-gray-500">{order.quantity} unidad(es)</p></td>
              <td className="px-4 py-3 text-sm">{order.supplierProduct.title}</td>
              <td className="px-4 py-3 text-sm">{order.supplier.name}</td>
              <td className="px-4 py-3 font-semibold">{money(salePrice, order.currency || 'ARS')}</td>
              <td className="px-4 py-3 text-sm">{money(financials.supplierTotal, order.supplierProduct.currency || order.currency || 'ARS')}</td>
              <td className={`px-4 py-3 text-sm font-semibold ${profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{money(profit, order.currency || 'ARS')}</td>
              <td className="px-4 py-3 text-sm">{financials.marginPercentage.toFixed(2)}%</td>
              <td className="px-4 py-3 text-sm">{order.supplierProduct.stock ?? '—'}</td>
              <td className="px-4 py-3 text-xs font-semibold">{labels[order.status]}</td>
              <td className="px-4 py-3">{actionable ? <PurchaseSupplierButton orderId={order.id} /> : <span className="text-xs text-gray-500">{order.supplierOrderId || 'Sin acción pendiente'}</span>}</td>
            </tr>;
          })}
          {!orders.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">Todavía no hay órdenes de Mercado Libre.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
