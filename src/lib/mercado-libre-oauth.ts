import { z } from 'zod';
import { withDistributedLock } from './distributed-lock';
import { portalDb } from './portal';
import { openSupplierCredential, sealSupplierCredential, supplierCredentialEncryptionConfigured } from './supplier-credentials';

const tokenSchema = z.object({
  access_token: z.string().min(10),
  refresh_token: z.string().min(10),
  token_type: z.string().min(1).default('bearer'),
  expires_in: z.number().int().positive().max(86_400),
  scope: z.string().optional(),
  user_id: z.union([z.string(), z.number()]).transform(String),
});

type TokenResponse = z.infer<typeof tokenSchema>;
type CredentialStore = Pick<typeof portalDb.marketplaceOAuthCredential, 'findFirst' | 'findUnique' | 'upsert' | 'update'>;

export function mercadoLibreOAuthConfigurationIssues() {
  const issues: string[] = [];
  const clientId = process.env.MERCADO_LIBRE_CLIENT_ID || process.env.MERCADO_LIBRE_APPLICATION_ID || process.env.MERCADO_LIBRE_APP_ID || '';
  if (!clientId.trim()) issues.push('MERCADO_LIBRE_CLIENT_ID');
  if (!(process.env.MERCADO_LIBRE_CLIENT_SECRET || '').trim()) issues.push('MERCADO_LIBRE_CLIENT_SECRET');
  if (!supplierCredentialEncryptionConfigured()) issues.push('SUPPLIER_CREDENTIALS_ENCRYPTION_KEY');
  try {
    const origin = new URL(process.env.MERCADO_LIBRE_OAUTH_ORIGIN || 'https://www.smartbrew.tech');
    if (origin.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && origin.hostname === 'localhost')) {
      issues.push('MERCADO_LIBRE_OAUTH_ORIGIN');
    }
  } catch {
    issues.push('MERCADO_LIBRE_OAUTH_ORIGIN');
  }
  return issues;
}

export function mercadoLibreOAuthConfig() {
  const clientId = process.env.MERCADO_LIBRE_CLIENT_ID || process.env.MERCADO_LIBRE_APPLICATION_ID || process.env.MERCADO_LIBRE_APP_ID || '';
  const clientSecret = process.env.MERCADO_LIBRE_CLIENT_SECRET || '';
  const origin = new URL(process.env.MERCADO_LIBRE_OAUTH_ORIGIN || 'https://www.smartbrew.tech');
  const issues = mercadoLibreOAuthConfigurationIssues();
  if (issues.length) throw new Error(`Mercado Libre OAuth no está configurado: ${issues.join(', ')}.`);
  return {
    clientId,
    clientSecret,
    redirectUri: `${origin.origin}/api/mercado-libre/oauth/callback`,
    tokenUrl: process.env.MERCADO_LIBRE_OAUTH_TOKEN_URL || 'https://api.mercadolibre.com/oauth/token',
    authorizationUrl: process.env.MERCADO_LIBRE_OAUTH_AUTHORIZATION_URL || 'https://auth.mercadolibre.com.ar/authorization',
  };
}

export function mercadoLibreAuthorizationUrl(state: string) {
  if (!/^[a-f0-9]{64}$/.test(state)) throw new Error('Estado OAuth inválido.');
  const config = mercadoLibreOAuthConfig();
  const url = new URL(config.authorizationUrl);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(parameters: URLSearchParams, fetcher: typeof fetch = fetch) {
  const response = await fetcher(mercadoLibreOAuthConfig().tokenUrl, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: parameters,
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const details = payload && !Array.isArray(payload) && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const code = typeof details.error === 'string' ? details.error : 'oauth_error';
    const description = typeof details.error_description === 'string' ? details.error_description : 'Sin detalle adicional.';
    throw new Error(`Mercado Libre rechazó la autorización (HTTP ${response.status}, ${code}): ${description}`.slice(0, 500));
  }
  return tokenSchema.parse(payload);
}

export async function exchangeMercadoLibreCode(code: string, fetcher: typeof fetch = fetch) {
  if (!/^[A-Za-z0-9_-]{6,500}$/.test(code)) throw new Error('Código OAuth inválido.');
  const config = mercadoLibreOAuthConfig();
  return tokenRequest(new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  }), fetcher);
}

async function refreshMercadoLibreToken(refreshToken: string, fetcher: typeof fetch = fetch) {
  const config = mercadoLibreOAuthConfig();
  return tokenRequest(new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  }), fetcher);
}

export async function persistMercadoLibreTokens(
  token: TokenResponse,
  options: { store?: CredentialStore; now?: Date } = {},
) {
  const store = options.store || portalDb.marketplaceOAuthCredential;
  const now = options.now || new Date();
  const accountId = token.user_id;
  return store.upsert({
    where: { accountId },
    create: {
      accountId,
      accessTokenEncrypted: sealSupplierCredential(token.access_token, accountId, 'mercadoLibreAccessToken'),
      refreshTokenEncrypted: sealSupplierCredential(token.refresh_token, accountId, 'mercadoLibreRefreshToken'),
      tokenType: token.token_type,
      scope: token.scope,
      expiresAt: new Date(now.getTime() + token.expires_in * 1_000),
      lastRefreshAt: now,
    },
    update: {
      accessTokenEncrypted: sealSupplierCredential(token.access_token, accountId, 'mercadoLibreAccessToken'),
      refreshTokenEncrypted: sealSupplierCredential(token.refresh_token, accountId, 'mercadoLibreRefreshToken'),
      tokenType: token.token_type,
      scope: token.scope,
      expiresAt: new Date(now.getTime() + token.expires_in * 1_000),
      lastRefreshAt: now,
      lastRefreshError: null,
    },
  });
}

export async function getMercadoLibreAccessToken(options: {
  accountId?: string;
  store?: CredentialStore;
  fetcher?: typeof fetch;
  now?: () => Date;
  withLock?: typeof withDistributedLock;
} = {}) {
  const store = options.store || portalDb.marketplaceOAuthCredential;
  const now = options.now || (() => new Date());
  const credential = options.accountId
    ? await store.findUnique({ where: { accountId: options.accountId } })
    : await store.findFirst({ where: { marketplace: 'MERCADO_LIBRE' }, orderBy: { updatedAt: 'desc' } });
  if (!credential) {
    const legacy = process.env.MERCADO_LIBRE_ACCESS_TOKEN || '';
    if (legacy.trim()) return legacy;
    throw new Error('Mercado Libre no está conectado.');
  }
  const readAccessToken = (record: typeof credential) => openSupplierCredential(
    record.accessTokenEncrypted,
    record.accountId,
    'mercadoLibreAccessToken',
  );
  if (credential.expiresAt.getTime() > now().getTime() + 5 * 60_000) return readAccessToken(credential);

  const runWithLock = options.withLock || withDistributedLock;
  return runWithLock(`mercado-libre-oauth-refresh:${credential.accountId}`, async () => {
    const current = await store.findUnique({ where: { accountId: credential.accountId } });
    if (!current) throw new Error('Mercado Libre no está conectado.');
    if (current.expiresAt.getTime() > now().getTime() + 5 * 60_000) return readAccessToken(current);
    try {
      const refreshToken = openSupplierCredential(current.refreshTokenEncrypted, current.accountId, 'mercadoLibreRefreshToken');
      const refreshed = await refreshMercadoLibreToken(refreshToken, options.fetcher);
      if (refreshed.user_id !== current.accountId) throw new Error('La cuenta renovada no coincide.');
      await persistMercadoLibreTokens(refreshed, { store, now: now() });
      return refreshed.access_token;
    } catch (error) {
      await store.update({
        where: { accountId: current.accountId },
        data: { lastRefreshError: error instanceof Error ? error.message.slice(0, 500) : 'Error desconocido.' },
      });
      throw new Error('La autorización de Mercado Libre venció. Volvé a conectar la cuenta.');
    }
  }, { ttlMs: 30_000, waitMs: 5_000 });
}
