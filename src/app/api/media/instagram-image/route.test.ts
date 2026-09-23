import { afterEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { signInstagramImage } from '../../../../lib/instagram-image';
import { GET } from './route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('rejects unsigned requests before downloading anything', async () => {
  vi.stubEnv('INSTAGRAM_IMAGE_PROXY_SECRET', 'test-secret');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(new Request('https://www.smartbrew.tech/api/media/instagram-image?url=https%3A%2F%2Fhttp2.mlstatic.com%2Fimage.jpg&sig=bad'));
  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('returns a normalized square JPEG for a valid signed Mercado Libre image', async () => {
  vi.stubEnv('INSTAGRAM_IMAGE_PROXY_SECRET', 'test-secret');
  const sourceUrl = 'https://http2.mlstatic.com/image.webp';
  const source = await sharp({ create: { width: 1600, height: 200, channels: 3, background: '#00aaff' } }).webp().toBuffer();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(source), {
    status: 200,
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(source.byteLength) },
  })));
  const url = new URL('https://www.smartbrew.tech/api/media/instagram-image');
  url.searchParams.set('url', sourceUrl);
  url.searchParams.set('sig', signInstagramImage(sourceUrl, 'test-secret'));

  const response = await GET(new Request(url));
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/jpeg');
  expect(metadata).toMatchObject({ width: 1080, height: 1080, format: 'jpeg' });
});
