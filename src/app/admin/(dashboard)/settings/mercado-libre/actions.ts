'use server';

import { redirect } from 'next/navigation';
import { mercadoLibreAuthorizationUrl } from '@/lib/mercado-libre-oauth';
import { portalDb, requireAdmin } from '@/lib/portal';
import { hashSecret, randomSecret } from '@/lib/portal-crypto';

export async function connectMercadoLibreAction() {
  await requireAdmin('/admin/settings/mercado-libre');
  const state = randomSecret();
  const now = new Date();
  await portalDb.$transaction([
    portalDb.marketplaceOAuthState.deleteMany({ where: { expiresAt: { lte: now } } }),
    portalDb.marketplaceOAuthState.create({
      data: { stateHash: hashSecret(state), expiresAt: new Date(now.getTime() + 10 * 60_000) },
    }),
  ]);
  redirect(mercadoLibreAuthorizationUrl(state));
}

export async function disconnectMercadoLibreAction() {
  await requireAdmin('/admin/settings/mercado-libre');
  await portalDb.marketplaceOAuthCredential.deleteMany({ where: { marketplace: 'MERCADO_LIBRE' } });
  redirect('/admin/settings/mercado-libre?disconnected=1');
}
