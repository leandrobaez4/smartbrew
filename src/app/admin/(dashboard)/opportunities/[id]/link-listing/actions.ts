'use server';

import { MarketplaceListingStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { MercadoLibreListingCandidate, MercadoLibreListingLookupClient } from '@/lib/mercado-libre-listing-lookup';
import { linkExternalMarketplaceListing } from '@/lib/marketplace-listings';
import { portalDb, requireAdmin } from '@/lib/portal';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const validMla = (value: string) => /^MLA\d{6,20}$/.test(value.trim().toUpperCase());

function listingStatus(value: string) {
  if (value === 'active') return MarketplaceListingStatus.ACTIVE;
  if (value === 'paused') return MarketplaceListingStatus.PAUSED;
  if (value === 'closed') return MarketplaceListingStatus.CLOSED;
  return MarketplaceListingStatus.ERROR;
}

async function context(productId: string) {
  if (!validId(productId)) throw new Error('invalid-product');
  const [product, credential] = await Promise.all([
    portalDb.supplierProduct.findUnique({ where: { id: productId }, select: { id: true, sku: true } }),
    portalDb.marketplaceOAuthCredential.findFirst({ where: { marketplace: 'MERCADO_LIBRE' }, orderBy: { updatedAt: 'desc' }, select: { accountId: true } }),
  ]);
  if (!product?.sku) throw new Error('missing-sku');
  if (!credential) throw new Error('missing-account');
  return { product, accountId: credential.accountId };
}

async function link(productId: string, itemId: string) {
  const { accountId } = await context(productId);
  const item = await new MercadoLibreListingLookupClient().getItem(accountId, itemId);
  await linkExternalMarketplaceListing({
    supplierProductId: productId,
    marketplaceAccountId: accountId,
    marketplaceItemId: item.id,
    price: item.price,
    status: listingStatus(item.status),
  });
}

function errorPath(productId: string, reason: string) {
  return `/admin/opportunities/${productId}/link-listing?error=${reason}`;
}

export async function searchAndLinkSellerSkuAction(productId: string) {
  await requireAdmin();
  let candidates: MercadoLibreListingCandidate[];
  try {
    const { product, accountId } = await context(productId);
    candidates = await new MercadoLibreListingLookupClient().searchBySellerSku(accountId, product.sku!);
  } catch {
    redirect(errorPath(productId, 'lookup'));
  }
  if (!candidates.length) redirect(errorPath(productId, 'not-found'));
  if (candidates.length === 1) {
    try {
      await link(productId, candidates[0].id);
    } catch (error) {
      if (error instanceof Error && error.message === 'listing-already-linked') redirect(errorPath(productId, 'reused'));
      redirect(errorPath(productId, 'lookup'));
    }
    redirect(`/admin/opportunities/${productId}?linked=1`);
  }
  redirect(`/admin/opportunities/${productId}/link-listing?candidates=${candidates.map((item) => item.id).join(',')}`);
}

export async function linkMarketplaceListingAction(productId: string, formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get('itemId') || '').trim().toUpperCase();
  if (!validMla(itemId)) redirect(errorPath(productId, 'invalid-mla'));
  try {
    await link(productId, itemId);
  } catch (error) {
    if (error instanceof Error && error.message === 'listing-already-linked') redirect(errorPath(productId, 'reused'));
    redirect(errorPath(productId, 'lookup'));
  }
  redirect(`/admin/opportunities/${productId}?linked=1`);
}
