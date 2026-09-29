import { z } from 'zod';
import { hasAdminApiSession } from '@/lib/admin-api';
import { portalDb } from '@/lib/portal';
import { quoteSupplierProductShipping } from '@/lib/supplier-shipping-quote';
import { SupplierPackageSchema } from '../../../../../lib/supplier-package';
import { getDropshippingSettings } from '@/lib/dropshipping-settings';

export const dynamic = 'force-dynamic';

const bodySchema = SupplierPackageSchema.extend({
  marketplaceAccountId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
}).strict();
const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const failure = (error: string, status: number) => Response.json({ error }, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasAdminApiSession()) return failure('No autorizado.', 401);
  const { id } = await context.params;
  if (!validId(id)) return failure('Identificador inválido.', 400);
  let body: unknown;
  try {
    if (Number(request.headers.get('content-length') || 0) > 8_192) throw new Error('payload');
    body = await request.json();
  } catch {
    return failure('Payload inválido.', 400);
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return failure('Completá peso y dimensiones válidos del paquete.', 400);
  const [product, settings] = await Promise.all([
    portalDb.supplierProduct.findUnique({ where: { id }, select: { pricing: true } }),
    getDropshippingSettings(),
  ]);
  if (!product?.pricing) return failure('Configurá primero los costos y el precio del producto.', 409);
  try {
    const { marketplaceAccountId, ...dimensions } = parsed.data;
    const quote = await quoteSupplierProductShipping({
      accountId: marketplaceAccountId,
      dimensions,
      pricing: product.pricing,
      minimumMarginPercentage: settings.minimumMargin,
      minimumProfitAmount: settings.minimumProfit,
    });
    return Response.json({
      shippingCostArs: quote.sellerCostArs,
      currencyId: quote.currencyId,
      finalPriceArs: quote.recommendedPrice,
      marketplaceFeeAmountArs: quote.marketplaceFeeAmount,
      targetProfitArs: quote.netProfit,
      marginPercentage: quote.marginPercentage,
      roiPercentage: quote.roi,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'No se pudo cotizar el envío.', 422);
  }
}
