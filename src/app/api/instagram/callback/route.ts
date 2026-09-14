import { NextRequest, NextResponse } from 'next/server';
import { portalDb, portalSession } from '@/lib/portal';
import { hashSecret, randomSecret, sealToken } from '@/lib/portal-crypto';
import { exchangeInstagramCode, instagramLoginConfig, instagramProfile } from '@/lib/instagram-login';

export async function GET(request: NextRequest) {
  let origin: string;
  try { origin = instagramLoginConfig().origin; } catch { return new NextResponse('Instagram login is not configured', { status: 503 }); }
  const back = (status: string) => {
    const response = NextResponse.redirect(`${origin}/portal/instagram?status=${status}`);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  const session = await portalSession();
  const state = request.nextUrl.searchParams.get('state') || '';
  if (!session || !/^[a-f0-9]{64}$/.test(state)) return back('invalid_state');
  // Bind to the logged-in browser AND consume once, before exchanging the code.
  const pending = hashSecret(randomSecret());
  const used = await portalDb.portalSession.updateMany({ where: { tokenHash: session.tokenHash, oauthStateHash: hashSecret(state), oauthExpiresAt: { gt: new Date() } }, data: { oauthStateHash: pending } });
  if (!used.count) return back('invalid_state');
  if (request.nextUrl.searchParams.has('error')) return back('denied');
  const code = request.nextUrl.searchParams.get('code');
  if (!code || code.length > 4096) return back('failed');
  try {
    const token = await exchangeInstagramCode(code);
    const profile = await instagramProfile(token.token);
    // Prevent a reviewer from linking the existing environment-backed production account.
    if (profile.user_id === process.env.INSTAGRAM_ACCOUNT_ID) return back('reserved');
    const encryptedToken = sealToken(token.token, session.memberId);
    await portalDb.$transaction(async tx => {
      // Serialize with member revocation, and re-check session after the network calls.
      const active = await tx.portalMember.updateMany({ where: { id: session.memberId, disabled: false }, data: { disabled: false } });
      if (!active.count) throw new Error('Member disabled');
      // Lock and consume the in-flight attempt. Disconnect/logout/new login can cancel it.
      const completed = await tx.portalSession.updateMany({ where: { tokenHash: session.tokenHash, oauthStateHash: pending, oauthExpiresAt: { gt: new Date() }, expiresAt: { gt: new Date() } }, data: { oauthStateHash: null, oauthExpiresAt: null } });
      if (!completed.count) throw new Error('Connection cancelled');
      await tx.instagramConnection.upsert({ where: { memberId: session.memberId }, create: { memberId: session.memberId, instagramId: profile.user_id, username: profile.username, encryptedToken, expiresAt: token.expiresAt }, update: { instagramId: profile.user_id, username: profile.username, encryptedToken, expiresAt: token.expiresAt } });
    });
    return back('connected');
  } catch { return back('failed'); }
}
