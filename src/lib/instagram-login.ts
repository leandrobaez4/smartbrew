import { z } from 'zod';

export function instagramLoginConfig() {
  const clientId = process.env.INSTAGRAM_OAUTH_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET;
  const origin = new URL(process.env.INSTAGRAM_PORTAL_ORIGIN || 'https://www.smartbrew.tech');
  if (origin.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && origin.hostname === 'localhost')) throw new Error('Invalid portal origin');
  if (!clientId || !clientSecret || !/^[a-f0-9]{64}$/i.test(process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '')) throw new Error('Instagram login is not configured');
  const version = process.env.INSTAGRAM_OAUTH_API_VERSION || 'v21.0';
  if (!/^v\d+\.0$/.test(version)) throw new Error('Invalid API version');
  return { clientId, clientSecret, origin: origin.origin, redirectUri: `${origin.origin}/api/instagram/callback`, version };
}

export function authorizationUrl(state: string) {
  const config = instagramLoginConfig();
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'instagram_business_basic', state, enable_fb_login: '0', force_authentication: '1' }).toString();
  return url.toString();
}

async function json(url: string, init?: RequestInit) {
  // Never propagate provider errors: they may contain credentials or user data.
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error();
    return data;
  } catch { throw new Error('Instagram request failed'); }
}

export async function exchangeInstagramCode(code: string) {
  const c = instagramLoginConfig();
  const short = z.object({ access_token: z.string().min(1) }).parse(await json('https://api.instagram.com/oauth/access_token', {
    method: 'POST', body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'authorization_code', redirect_uri: c.redirectUri, code }),
  }));
  const url = new URL('https://graph.instagram.com/access_token');
  url.search = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: c.clientSecret, access_token: short.access_token }).toString();
  const long = z.object({ access_token: z.string().min(1), expires_in: z.number().positive().max(90 * 86400) }).parse(await json(url.toString()));
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000) };
}

export async function instagramProfile(token: string) {
  const { version } = instagramLoginConfig();
  const data = await json(`https://graph.instagram.com/${version}/me?fields=user_id,username`, { headers: { Authorization: `Bearer ${token}` } });
  return z.object({ user_id: z.string().regex(/^\d+$/), username: z.string().min(1).max(100) }).parse(data);
}
