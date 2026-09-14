import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { authorizationUrl, exchangeInstagramCode, instagramProfile } from './instagram-login';
beforeEach(() => {
  vi.stubEnv('INSTAGRAM_OAUTH_CLIENT_ID', '123');
  vi.stubEnv('INSTAGRAM_OAUTH_CLIENT_SECRET', 'private-secret');
  vi.stubEnv('INSTAGRAM_PORTAL_ORIGIN', 'https://www.smartbrew.tech');
  vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'b'.repeat(64));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('requests Basic only and uses a fixed redirect without a client secret', () => {
  const url = new URL(authorizationUrl('nonce'));
  expect(url.origin).toBe('https://www.instagram.com');
  expect(url.searchParams.get('scope')).toBe('instagram_business_basic');
  expect(url.searchParams.get('state')).toBe('nonce');
  expect(url.searchParams.get('redirect_uri')).toBe('https://www.smartbrew.tech/api/instagram/callback');
  expect(url.toString()).not.toContain('private-secret');
});
it('exchanges code server-side and gets profile from Instagram, never Facebook', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'short' }))
    .mockResolvedValueOnce(Response.json({ access_token: 'long', expires_in: 5184000 }))
    .mockResolvedValueOnce(Response.json({ user_id: '12345', username: 'testbusiness' }));
  vi.stubGlobal('fetch', fetchMock);
  const result = await exchangeInstagramCode('code');
  expect(result.token).toBe('long');
  expect((await instagramProfile(result.token)).username).toBe('testbusiness');
  expect(fetchMock.mock.calls[0][0]).toBe('https://api.instagram.com/oauth/access_token');
  expect(fetchMock.mock.calls[2][0]).toContain('https://graph.instagram.com/');
});
it('does not expose provider errors or secrets', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { message: 'SECRET' } }, { status: 401 })));
  await expect(instagramProfile('token')).rejects.toThrow('Instagram request failed');
});
