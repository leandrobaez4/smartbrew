import { IntegrationLogStatus, MarketplaceListingStatus, OrderStatus, SupplierStatus } from '@prisma/client';
import { portalDb } from './portal';

export const dashboardPeriods = [1, 7, 30, 90] as const;
export type DashboardPeriod = typeof dashboardPeriods[number];

export function parseDashboardPeriod(value: string | undefined): DashboardPeriod {
  const parsed = Number(value);
  return dashboardPeriods.includes(parsed as DashboardPeriod) ? parsed as DashboardPeriod : 30;
}

export function dashboardPeriodStart(period: DashboardPeriod, now = new Date()) {
  return new Date(now.getTime() - period * 86_400_000);
}

export function summarizeOrderFinancials(orders: Array<{ salePrice: number; profit: number }>) {
  const revenue = orders.reduce((sum, order) => sum + order.salePrice, 0);
  const estimatedProfit = orders.reduce((sum, order) => sum + order.profit, 0);
  const averageMargin = orders.length
    ? orders.reduce((sum, order) => sum + (order.salePrice ? order.profit / order.salePrice * 100 : 0), 0) / orders.length
    : 0;
  return {
    revenue: Math.round(revenue * 100) / 100,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    averageMargin: Math.round(averageMargin * 100) / 100,
  };
}

export async function getDropshippingDashboard(period: DashboardPeriod, now = new Date()) {
  const from = dashboardPeriodStart(period, now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const validOrders = { createdAt: { gte: from }, status: { not: OrderStatus.CANCELLED } } as const;
  const [activeProducts, activeSuppliers, marketplaceListings, ordersToday, orders, productsPaused, productsWithoutStock, supplierErrors] = await Promise.all([
    portalDb.supplierProduct.count({ where: { active: true, stock: { gt: 0 }, supplier: { status: SupplierStatus.ACTIVE } } }),
    portalDb.supplier.count({ where: { status: SupplierStatus.ACTIVE } }),
    portalDb.marketplaceListing.count({ where: { status: MarketplaceListingStatus.ACTIVE } }),
    portalDb.order.count({ where: { createdAt: { gte: today }, status: { not: OrderStatus.CANCELLED } } }),
    portalDb.order.findMany({ where: validOrders, select: { salePrice: true, profit: true } }),
    portalDb.marketplaceListing.count({ where: { status: MarketplaceListingStatus.PAUSED } }),
    portalDb.supplierProduct.count({ where: { active: true, OR: [{ stock: null }, { stock: { lte: 0 } }] } }),
    portalDb.integrationLog.count({ where: { status: IntegrationLogStatus.ERROR, createdAt: { gte: from } } }),
  ]);
  return {
    period,
    from,
    activeProducts,
    activeSuppliers,
    marketplaceListings,
    ordersToday,
    ...summarizeOrderFinancials(orders.map((order) => ({
      salePrice: Number(order.salePrice),
      profit: Number(order.profit),
    }))),
    productsPaused,
    productsWithoutStock,
    supplierErrors,
  };
}
