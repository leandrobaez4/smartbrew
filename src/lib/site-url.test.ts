import { afterEach, describe, expect, it } from 'vitest';
import { absoluteSiteUrl, getSiteUrl } from './site-url';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('public site URL', () => {
  it('uses the SmartBrew production domain when configuration is absent or unsafe', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl().origin).toBe('https://www.smartbrew.tech');
    process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';
    expect(getSiteUrl().origin).toBe('https://www.smartbrew.tech');
  });

  it('accepts an explicit HTTPS origin and creates absolute URLs', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://smartbrew.example/some-path';
    expect(getSiteUrl().href).toBe('https://smartbrew.example/');
    expect(absoluteSiteUrl('/productos/1')).toBe('https://smartbrew.example/productos/1');
  });
});
