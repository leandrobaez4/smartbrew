// IDs keep links stable when a product title changes; no migration is needed.
export function productPath(id: string) {
  return `/productos/${encodeURIComponent(id)}`;
}
export function productUrl(id: string, origin = 'https://www.smartbrew.tech') {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password) throw Error('El dominio público debe usar HTTPS.');
  return new URL(productPath(id), base.origin).href;
}
export function safeAffiliateUrl(value: string | null) {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname !== 'meli.la' && url.hostname !== 'mercadolibre.com.ar' && !url.hostname.endsWith('.mercadolibre.com.ar')) return null;
    return url.href;
  } catch { return null; }
}
