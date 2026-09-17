// Self-contained for chrome.scripting.executeScript. Read only product gallery DOM.
export function collectProductGallery() {
  if (location.origin !== 'https://www.mercadolibre.com.ar') return [];
  const photos = new Map();
  function add(raw, quality = 0) {
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== 'https://http2.mlstatic.com' || url.username || url.password) return;
      url.search = ''; url.hash = '';
      // ML picture identifier remains identical across thumbnail/full-size variants.
      const key = url.pathname.match(/(\d+-(?:MLA|MLU|MLM|MLB|CBT)\d+_\d+)/i)?.[1] || url.pathname;
      if (!photos.has(key) || quality > photos.get(key).quality) photos.set(key, { url: url.href, quality });
    } catch { /* Ignore malformed image sources. */ }
  }
  for (const img of document.querySelectorAll('img.ui-pdp-image')) {
    for (const srcset of [img.getAttribute('srcset'), img.getAttribute('data-srcset')]) {
      for (const candidate of (srcset || '').split(',')) {
        const [url, descriptor] = candidate.trim().split(/\s+/);
        if (url) add(url, parseFloat(descriptor || '0') * (descriptor?.endsWith('x') ? 1000 : 1));
      }
    }
    add(img.getAttribute('data-zoom'), 10000);
    add(img.currentSrc || img.getAttribute('data-src') || img.src, img.naturalWidth || 0);
  }
  return [...photos.values()].slice(0, 20).map(photo => photo.url);
}
