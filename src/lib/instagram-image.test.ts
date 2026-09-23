import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  buildInstagramImageUrl,
  isAllowedInstagramImageSource,
  normalizeInstagramImage,
  signInstagramImage,
  verifyInstagramImageSignature,
} from './instagram-image';

afterEach(() => vi.unstubAllEnvs());

describe('Instagram image proxy', () => {
  it('only accepts HTTPS image files from Mercado Libre or configured hosts', () => {
    expect(isAllowedInstagramImageSource('https://http2.mlstatic.com/product.webp')).toBe(true);
    expect(isAllowedInstagramImageSource('https://images.example.org/product.jpg', 'images.example.org')).toBe(true);
    expect(isAllowedInstagramImageSource('http://http2.mlstatic.com/product.jpg')).toBe(false);
    expect(isAllowedInstagramImageSource('https://http2.mlstatic.com/product.mp4')).toBe(false);
    expect(isAllowedInstagramImageSource('https://127.0.0.1/product.jpg')).toBe(false);
  });

  it('builds a signed URL without exposing the signing secret', () => {
    const source = 'https://http2.mlstatic.com/product.webp';
    const result = new URL(buildInstagramImageUrl(source, 'https://www.smartbrew.tech', 'secret'));
    const signature = result.searchParams.get('sig') || '';
    expect(result.origin + result.pathname).toBe('https://www.smartbrew.tech/api/media/instagram-image');
    expect(result.searchParams.get('url')).toBe(source);
    expect(verifyInstagramImageSignature(source, signature, 'secret')).toBe(true);
    expect(verifyInstagramImageSignature(source, signature, 'other-secret')).toBe(false);
    expect(result.toString()).not.toContain('secret');
    expect(signature).toBe(signInstagramImage(source, 'secret'));
  });

  it('normalizes an extreme portrait into a square JPEG accepted by Instagram', async () => {
    const source = await sharp({ create: { width: 200, height: 1200, channels: 3, background: '#ff6600' } }).png().toBuffer();
    const normalized = await normalizeInstagramImage(source);
    const metadata = await sharp(normalized).metadata();
    expect(metadata).toMatchObject({ width: 1080, height: 1080, format: 'jpeg' });
  });
});
