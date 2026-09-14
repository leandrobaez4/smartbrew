import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sendPortalInvitation } from './portal-email';
beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'private-key');
  vi.stubEnv('PORTAL_EMAIL_FROM', 'SmartBrew <invitaciones@smartbrew.tech>');
  vi.stubEnv('INSTAGRAM_PORTAL_ORIGIN', 'https://www.smartbrew.tech');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('sends a plain-text invitation with a stable idempotency key', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'email-123' }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await sendPortalInvitation('member@example.com', 'code', 'hash')).toBe('email-123');
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(options.headers['Idempotency-Key']).toBe('portal-invite/hash');
  const body = JSON.parse(options.body);
  expect(body.to).toEqual(['member@example.com']);
  expect(body.text).toContain('https://www.smartbrew.tech/portal/activate#token=code');
  expect(body.text).toContain('code');
  expect(body.text).not.toContain('private-key');
});
it('fails before sending when configuration is missing', async () => {
  vi.stubEnv('RESEND_API_KEY', '');
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  await expect(sendPortalInvitation('member@example.com', 'code', 'hash')).rejects.toThrow('Email not configured');
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([Response.json({ message: 'private provider details' }, { status: 403 }), Response.json({})])('does not claim success on rejection or malformed response', async response => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
  await expect(sendPortalInvitation('member@example.com', 'code', 'hash')).rejects.toThrow('No se pudo confirmar el envío del email.');
});
