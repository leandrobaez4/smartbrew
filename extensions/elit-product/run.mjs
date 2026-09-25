import { extractElitProduct } from './extract.mjs';

export function canConfigureProduct(product) {
  return Boolean(product && typeof product === 'object' && product.externalId && product.title);
}

export async function withDeadline(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function extractCurrentProduct(chrome, onProgress, deadlines = { tab: 5000, extraction: 8000 }) {
  onProgress('1/2 · Comprobando la pestaña…');
  const [tab] = await withDeadline(
    chrome.tabs.query({ active: true, currentWindow: true }),
    deadlines.tab,
    'Chrome no respondió al consultar la pestaña. Cerrá el panel y recargá la extensión.',
  );
  if (!tab?.id || !/^https:\/\/(?:www\.)?elit\.com\.ar\/producto\//.test(tab.url || '')) {
    throw new Error('Abrí un producto en elit.com.ar y tocá el icono de la extensión.');
  }

  onProgress('2/2 · Leyendo los datos del producto…');
  const [execution] = await withDeadline(
    chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: extractElitProduct }),
    deadlines.extraction,
    'Chrome no devolvió los datos a tiempo. Recargá la página y volvé a probar.',
  );
  const response = execution?.result;
  if (!response?.ok) throw new Error(response?.message || 'No se pudo leer el producto de Elit.');
  return response;
}
