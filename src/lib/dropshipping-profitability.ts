import { OrderStatus } from '@prisma/client';
import { dashboardPeriodStart, type DashboardPeriod } from './dropshipping-dashboard';
import { portalDb } from './portal';

export const profitabilityGroups = ['product', 'supplier', 'category', 'day', 'week', 'month'] as const;
export type ProfitabilityGroup = typeof profitabilityGroups[number];

export function parseProfitabilityGroup(value: string | undefined): ProfitabilityGroup {
  return profitabilityGroups.includes(value as ProfitabilityGroup) ? value as ProfitabilityGroup : 'product';
}

export type ProfitabilityRow = {
  salePrice: number;
  quantity: number;
  supplierCost: number;
  marketplaceFee: number;
  shippingCost: number;
  taxes: number;
  financialsEstimated: boolean;
  orderedAt: Date | null;
  createdAt: Date;
  supplier: { id: string; name: string };
  supplierProduct: { id: string; title: string; category: string | null };
};

export type ProfitabilityMetric = {
  key: string;
  label: string;
  orders: number;
  revenue: number;
  supplierCost: number;
  marketplaceFees: number;
  shipping: number;
  taxes: number;
  netProfit: number;
  margin: number;
  roi: number;
  estimated: boolean;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function dateKey(date: Date, group: ProfitabilityGroup) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (group === 'month') return `${year}-${month}`;
  if (group === 'day') return `${year}-${month}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const copy = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const first = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - first.getTime()) / 86_400_000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function groupIdentity(row: ProfitabilityRow, group: ProfitabilityGroup) {
  if (group === 'product') return [row.supplierProduct.id, row.supplierProduct.title] as const;
  if (group === 'supplier') return [row.supplier.id, row.supplier.name] as const;
  if (group === 'category') {
    const category = row.supplierProduct.category?.trim() || 'Sin categoría';
    return [category, category] as const;
  }
  const key = dateKey(row.orderedAt || row.createdAt, group);
  return [key, key] as const;
}

export function aggregateProfitability(rows: ProfitabilityRow[], group: ProfitabilityGroup): ProfitabilityMetric[] {
  const groups = new Map<string, ProfitabilityMetric>();
  for (const row of rows) {
    const [key, label] = groupIdentity(row, group);
    const metric = groups.get(key) || {
      key, label, orders: 0, revenue: 0, supplierCost: 0, marketplaceFees: 0,
      shipping: 0, taxes: 0, netProfit: 0, margin: 0, roi: 0, estimated: false,
    };
    metric.orders += 1;
    metric.revenue += row.salePrice;
    metric.supplierCost += row.supplierCost * row.quantity;
    metric.marketplaceFees += row.marketplaceFee;
    metric.shipping += row.shippingCost;
    metric.taxes += row.taxes;
    metric.estimated ||= row.financialsEstimated;
    groups.set(key, metric);
  }
  return Array.from(groups.values()).map((metric) => {
    const invested = metric.supplierCost + metric.marketplaceFees + metric.shipping + metric.taxes;
    const netProfit = metric.revenue - invested;
    return {
      ...metric,
      revenue: round(metric.revenue), supplierCost: round(metric.supplierCost),
      marketplaceFees: round(metric.marketplaceFees), shipping: round(metric.shipping), taxes: round(metric.taxes),
      netProfit: round(netProfit),
      margin: round(metric.revenue ? netProfit / metric.revenue * 100 : 0),
      roi: round(invested ? netProfit / invested * 100 : 0),
    };
  }).sort((a, b) => group === 'day' || group === 'week' || group === 'month'
    ? b.key.localeCompare(a.key)
    : b.netProfit - a.netProfit);
}

export async function getProfitability(period: DashboardPeriod, group: ProfitabilityGroup, now = new Date()) {
  const from = dashboardPeriodStart(period, now);
  const orders = await portalDb.order.findMany({
    where: { createdAt: { gte: from }, status: { not: OrderStatus.CANCELLED } },
    select: {
      salePrice: true, quantity: true, supplierCost: true, marketplaceFee: true,
      shippingCost: true, taxes: true, financialsEstimated: true, orderedAt: true, createdAt: true,
      supplier: { select: { id: true, name: true } },
      supplierProduct: { select: { id: true, title: true, category: true } },
    },
  });
  const rows = aggregateProfitability(orders.map((order) => ({
    ...order,
    salePrice: Number(order.salePrice), supplierCost: Number(order.supplierCost),
    marketplaceFee: Number(order.marketplaceFee), shippingCost: Number(order.shippingCost), taxes: Number(order.taxes),
  })), group);
  const totals = aggregateProfitability(orders.map((order) => ({
    ...order,
    salePrice: Number(order.salePrice), supplierCost: Number(order.supplierCost),
    marketplaceFee: Number(order.marketplaceFee), shippingCost: Number(order.shippingCost), taxes: Number(order.taxes),
    supplier: { id: 'all', name: 'Total' },
  })), 'supplier')[0] || {
    key: 'all', label: 'Total', orders: 0, revenue: 0, supplierCost: 0, marketplaceFees: 0,
    shipping: 0, taxes: 0, netProfit: 0, margin: 0, roi: 0, estimated: false,
  };
  return { period, group, from, rows, totals };
}
