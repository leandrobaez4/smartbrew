import { extractUnidropProduct } from './extract.mjs';

export function canConfigureProduct(product) {
  return Boolean(product && typeof product === 'object' && product.externalId && product.title && product.sku);
}

export function createImportCommand(product) {
  if (!canConfigureProduct(product)) throw new Error('Seleccioná una variante válida para importar.');
  return {
    version: 1,
    command: 'IMPORT_SUPPLIER_PRODUCT',
    supplierSlug: 'unidrop',
    externalId: product.externalId,
    snapshot: product,
  };
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
  if (!tab?.id || !/^https:\/\/(?:www\.)?unidrop\.com\.ar\/panel\/catalogue\/\d+(?:\/|\?|$)/.test(tab.url || '')) {
    throw new Error('Abrí una ficha de producto en Unidrop y tocá el icono de la extensión.');
  }

  onProgress('2/2 · Leyendo variantes, costo y stock…');
  const [execution] = await withDeadline(
    chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: extractUnidropProduct }),
    deadlines.extraction,
    'Chrome no devolvió los datos a tiempo. Recargá la página y volvé a probar.',
  );
  const response = execution?.result;
  if (!response?.ok) throw new Error(response?.message || 'No se pudo leer el producto de Unidrop.');
  return response;
}
