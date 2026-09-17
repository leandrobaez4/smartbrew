import { z } from 'zod';
import { mergeProductImages } from './product-gallery';

export function mlIdentity(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !['www.mercadolibre.com.ar', 'articulo.mercadolibre.com.ar'].includes(url.hostname) || url.port || url.username || url.password) throw Error('URL de producto no permitida.');
  const id = (url.pathname.match(/\/up\/(MLAU\d+)(?:\/|$)/i)?.[1] ||
    url.pathname.match(/\/((?:MLA)-?\d+)(?:[-/]|$)/i)?.[1])?.replace('-', '').toUpperCase();
  if (!id) throw Error('No se encontró el ID del producto.');
  // Preserve path identity (MLA or MLAU); tracking/wid must not change the import key.
  url.hash = ''; url.search = '';
  return { externalId: id, url: url.href };
}
const inputSchema = z.object({
  images: z.preprocess(value => {
    if (value === undefined || value === null || value === '') return [];
    if (typeof value === 'string' && value.length <= 16000) { try { return JSON.parse(value); } catch { return value; } }
    return value;
  }, z.array(z.string().max(2048).url().refine(value => {
    const u = new URL(value);
    return u.origin === 'https://http2.mlstatic.com' && !u.username && !u.password;
  })).max(20)).default([]),
  url: z.string().max(4096),
  affiliateUrl: z.string().max(200).url().refine(value => /^https:\/\/meli\.la\/[A-Za-z0-9_-]+$/.test(value), 'Enlace de afiliado no permitido.'),
  title: z.string().trim().min(1).max(500),
  image: z.string().max(2048).default('').refine(value => {
    if (!value) return true;
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'http2.mlstatic.com' && !u.port && !u.username && !u.password; } catch { return false; }
  }, 'Imagen no permitida.'),
});
export function parseAffiliateImport(raw: unknown) {
  const data = inputSchema.parse(raw);
  const images = mergeProductImages(data.images, data.image ? [data.image] : []).slice(0, 20);
  return { ...data, images, ...mlIdentity(data.url) };
}
