import { createHmac, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = /\.(?:avif|jpe?g|png|webp)$/i;
const OUTPUT_SIZE = 1080;

function configuredHosts(raw = process.env.INSTAGRAM_IMAGE_ALLOWED_HOSTS || '') {
  return new Set(raw.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
}

export function isAllowedInstagramImageSource(raw: string, extraHosts?: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    const allowedHost = host === 'mlstatic.com' || host.endsWith('.mlstatic.com') || configuredHosts(extraHosts).has(host);
    return allowedHost && IMAGE_EXTENSIONS.test(url.pathname);
  } catch {
    return false;
  }
}

export function signInstagramImage(sourceUrl: string, secret: string) {
  return createHmac('sha256', secret).update(sourceUrl).digest('hex');
}

export function verifyInstagramImageSignature(sourceUrl: string, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signInstagramImage(sourceUrl, secret), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildInstagramImageUrl(sourceUrl: string, appUrl: string, secret: string) {
  if (!isAllowedInstagramImageSource(sourceUrl)) throw new Error('La imagen usa un origen no permitido para Instagram.');
  const base = new URL(appUrl);
  if (base.protocol !== 'https:') throw new Error('APP_URL debe usar HTTPS para que Instagram descargue las imágenes.');
  const proxy = new URL('/api/media/instagram-image', base);
  proxy.searchParams.set('url', sourceUrl);
  proxy.searchParams.set('sig', signInstagramImage(sourceUrl, secret));
  return proxy.toString();
}

export async function normalizeInstagramImage(input: Buffer | Uint8Array) {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
}
