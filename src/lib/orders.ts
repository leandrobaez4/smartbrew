export type OrderFinancialInput = {
  salePrice: number;
  supplierCost: number;
  quantity: number;
  profit: number;
};

export function orderFinancials(input: OrderFinancialInput) {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  }
  if (input.salePrice < 0 || input.supplierCost < 0 || input.quantity < 1 || !Number.isSafeInteger(input.quantity)) {
    throw new Error('Invalid order financial values');
  }
  return {
    supplierTotal: Math.round(input.supplierCost * input.quantity * 100) / 100,
    marginPercentage: input.salePrice === 0 ? 0 : Math.round((input.profit / input.salePrice) * 10_000) / 100,
  };
}
