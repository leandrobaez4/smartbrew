import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exchangeMercadoLibreCode, getMercadoLibreAccessToken, mercadoLibreAuthorizationUrl, mercadoLibreOAuthConfigurationIssues } from './mercado-libre-oauth';
import { sealSupplierCredential } from './supplier-credentials';

const now = new Date('2026-09-28T17:00:00Z');

beforeEach(() => {
  delete process.env.MERCADO_LIBRE_APPLICATION_ID;
  delete process.env.MERCADO_LIBRE_APP_ID;
  process.env.MERCADO_LIBRE_CLIENT_ID = 'app-123';
  process.env.MERCADO_LIBRE_CLIENT_SECRET = 'secret-456';
  process.env.MERCADO_LIBRE_OAUTH_ORIGIN = 'https://smartbrew.test';
  process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = 'a'.repeat(64);
  delete process.env.MERCADO_LIBRE_ACCESS_TOKEN;
});

describe('Mercado Libre OAuth', () => {
  it('builds the server-side authorization URL with an exact redirect and state', () => {
    const state = 'b'.repeat(64);
    const url = new URL(mercadoLibreAuthorizationUrl(state));
    expect(url.origin).toBe('https://auth.mercadolibre.com.ar');
    expect(url.searchParams.get('client_id')).toBe('app-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://smartbrew.test/api/mercado-libre/oauth/callback');
    expect(url.searchParams.get('state')).toBe(state);
  });

  it('reports a missing encryption key before starting authorization', () => {
    delete process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY;
    expect(mercadoLibreOAuthConfigurationIssues()).toContain('SUPPLIER_CREDENTIALS_ENCRYPTION_KEY');
    expect(() => mercadoLibreAuthorizationUrl('b'.repeat(64))).toThrow('SUPPLIER_CREDENTIALS_ENCRYPTION_KEY');
  });

  it('accepts the legacy app id while the environment migrates to client id', () => {
    delete process.env.MERCADO_LIBRE_CLIENT_ID;
    process.env.MERCADO_LIBRE_APP_ID = 'legacy-app-123';
    const url = new URL(mercadoLibreAuthorizationUrl('b'.repeat(64)));
    expect(url.searchParams.get('client_id')).toBe('legacy-app-123');
  });

  it('preserves the safe Mercado Libre error details when code exchange fails', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      error: 'invalid_grant',
      error_description: 'The authorization code is invalid or expired',
    }, { status: 400 }));
    await expect(exchangeMercadoLibreCode('valid-code', fetcher as never)).rejects.toThrow(
      'HTTP 400, invalid_grant',
    );
  });

  it('returns a valid encrypted access token without refreshing it', async () => {
    const credential = {
      accountId: '84259783',
      marketplace: 'MERCADO_LIBRE',
      accessTokenEncrypted: sealSupplierCredential('APP_USR-valid-token', '84259783', 'mercadoLibreAccessToken'),
      refreshTokenEncrypted: sealSupplierCredential('TG-valid-refresh', '84259783', 'mercadoLibreRefreshToken'),
      expiresAt: new Date(now.getTime() + 60 * 60_000),
      updatedAt: now,
    };
    const store = {
      findFirst: vi.fn().mockResolvedValue(credential),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    };

    await expect(getMercadoLibreAccessToken({ store: store as never, now: () => now })).resolves.toBe('APP_USR-valid-token');
    expect(store.findUnique).not.toHaveBeenCalled();
  });

  it('rotates the one-use refresh token and persists the replacement', async () => {
    const credential = {
      accountId: '84259783',
      marketplace: 'MERCADO_LIBRE',
      accessTokenEncrypted: sealSupplierCredential('APP_USR-expired-token', '84259783', 'mercadoLibreAccessToken'),
      refreshTokenEncrypted: sealSupplierCredential('TG-current-refresh', '84259783', 'mercadoLibreRefreshToken'),
      expiresAt: new Date(now.getTime() - 1_000),
      updatedAt: now,
    };
    const store = {
      findFirst: vi.fn().mockResolvedValue(credential),
      findUnique: vi.fn().mockResolvedValue(credential),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn(),
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'APP_USR-replacement-token',
      refresh_token: 'TG-replacement-refresh',
      token_type: 'bearer',
      expires_in: 21_600,
      scope: 'offline_access read write',
      user_id: 84259783,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const withLock = vi.fn(async (_resource: string, task: () => Promise<string>) => task());

    await expect(getMercadoLibreAccessToken({
      store: store as never,
      fetcher: fetcher as never,
      now: () => now,
      withLock: withLock as never,
    })).resolves.toBe('APP_USR-replacement-token');
    expect(fetcher).toHaveBeenCalledWith('https://api.mercadolibre.com/oauth/token', expect.objectContaining({ method: 'POST' }));
    expect(String(fetcher.mock.calls[0][1].body)).toContain('grant_type=refresh_token');
    expect(store.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { accountId: '84259783' },
      update: expect.objectContaining({ lastRefreshError: null }),
    }));
  });
});
