// Self-contained: Chrome serializes this function into an isolated content script.
// No cookie/token extraction, page-world code, storage, or remote executable code.
export async function requestAffiliateLink() {
  if (location.origin !== 'https://www.mercadolibre.com.ar' ||
      !(/\/up\/MLAU\d+(?:\/|$)/i.test(location.pathname) || /\/MLA-?\d+(?:[-/]|$)/i.test(location.pathname))) {
    return { ok: false, message: 'Abrí la página de un producto en www.mercadolibre.com.ar y volvé a probar.' };
  }
  // Shared by popup invocations in this tab, preventing concurrent requests.
  if (globalThis.__smartbrewAffiliateBusy) return { ok: false, message: 'Ya hay una solicitud en curso en esta pestaña.' };
  globalThis.__smartbrewAffiliateBusy = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/affiliate-program/api/v2/stripe/user/links', {
      method: 'POST', credentials: 'same-origin', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: location.href, tag: 'leandrobaez1983' }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, message: `HTTP ${response.status}. No se confirmó la generación. Revisá tu sesión y el acceso a Afiliados. No se reintentó.` };
    if (!response.headers.get('content-type')?.includes('application/json')) {
      return { ok: false, message: 'Mercado Libre no devolvió JSON. No se pudo confirmar el enlace; revisá la sesión.' };
    }
    const data = await response.json();
    // Response shape is not yet verified. Only expose a single validated short link,
    // never the raw payload (which could contain private account information).
    const links = new Set();
    function visit(value, depth = 0) {
      if (depth > 8) return;
      if (typeof value === 'string') {
        try {
          const url = new URL(value);
          if (url.origin === 'https://meli.la' && /^\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash) links.add(url.href);
        } catch { /* Not a URL. */ }
      } else if (value && typeof value === 'object') {
        for (const item of Object.values(value)) visit(item, depth + 1);
      }
    }
    visit(data);
    if (links.size !== 1) return { ok: false, message: 'La API respondió, pero el formato del enlace no está reconocido o es ambiguo. Revisá el resultado en Mercado Libre antes de repetir.' };
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const cover = document.querySelector('img.ui-pdp-image.ui-pdp-gallery__figure__image');
    const image = cover?.currentSrc || cover?.getAttribute('data-src') || cover?.src || '';
    return { ok: true, link: [...links][0], product: { url: location.href, title, image }, message: 'Enlace recibido. Podés enviarlo a SmartBrew para confirmar su importación.' };
  } catch {
    return { ok: false, message: 'No se pudo confirmar la respuesta (red, redirección o tiempo agotado). Revisá Mercado Libre antes de repetir: la solicitud podría haberse procesado.' };
  } finally {
    clearTimeout(timer);
    globalThis.__smartbrewAffiliateBusy = false;
  }
}
