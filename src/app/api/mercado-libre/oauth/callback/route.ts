import { NextResponse } from 'next/server';
import { exchangeMercadoLibreCode, mercadoLibreOAuthConfig, persistMercadoLibreTokens } from '@/lib/mercado-libre-oauth';
import { portalDb, requireAdmin } from '@/lib/portal';
import { hashSecret } from '@/lib/portal-crypto';
import { logSystemEvent } from '@/lib/logger';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido.';
}

export async function GET(request: Request) {
  await requireAdmin('/admin/settings/mercado-libre');
  const url = new URL(request.url);
  const trustedOrigin = new URL(mercadoLibreOAuthConfig().redirectUri).origin;
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  if (!/^[A-Za-z0-9_-]{6,500}$/.test(code) || !/^[a-f0-9]{64}$/.test(state)) {
    return NextResponse.redirect(new URL('/admin/settings/mercado-libre?error=invalid_callback', trustedOrigin));
  }
  const consumed = await portalDb.marketplaceOAuthState.deleteMany({
    where: { stateHash: hashSecret(state), expiresAt: { gt: new Date() } },
  });
  if (consumed.count !== 1) {
    return NextResponse.redirect(new URL('/admin/settings/mercado-libre?error=invalid_state', trustedOrigin));
  }
  let token;
  try {
    token = await exchangeMercadoLibreCode(code);
  } catch (error) {
    await logSystemEvent('ERROR', 'mercado_libre_oauth', 'Mercado Libre OAuth token exchange failed', {
      phase: 'token_exchange',
      error: errorMessage(error),
    });
    return NextResponse.redirect(new URL('/admin/settings/mercado-libre?error=token_exchange', trustedOrigin));
  }
  try {
    await persistMercadoLibreTokens(token);
    return NextResponse.redirect(new URL('/admin/settings/mercado-libre?connected=1', trustedOrigin));
  } catch (error) {
    await logSystemEvent('ERROR', 'mercado_libre_oauth', 'Mercado Libre OAuth credential storage failed', {
      phase: 'credential_storage',
      accountId: token.user_id,
      error: errorMessage(error),
    });
    return NextResponse.redirect(new URL('/admin/settings/mercado-libre?error=credential_storage', trustedOrigin));
  }
}
