import { resolveProductSource } from './registry.mjs';

export function canConfigureProduct(product) {
  return Boolean(product && typeof product === 'object' && product.externalId && product.title);
}

export function createImportCommand(product, supplierSlug = product?.supplier) {
  if (!canConfigureProduct(product)) throw new Error('No hay un producto válido para importar.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(supplierSlug || '')) {
    throw new Error('No se pudo identificar el proveedor del producto.');
  }
  return {
    version: 1,
    command: 'IMPORT_SUPPLIER_PRODUCT',
    supplierSlug,
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
  const source = tab?.id ? resolveProductSource(tab.url || '') : null;
  if (!tab?.id || !source) throw new Error('Abrí un producto compatible de Elit o Unidrop y tocá el icono de la extensión.');

  onProgress(`2/2 · Leyendo los datos de ${source.label}…`);
  const [execution] = await withDeadline(
    chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: source.extractor }),
    deadlines.extraction,
    'Chrome no devolvió los datos a tiempo. Recargá la página y volvé a probar.',
  );
  const response = execution?.result;
  if (!response?.ok) throw new Error(response?.message || `No se pudo leer el producto de ${source.label}.`);
  return { ...response, source: { slug: source.slug, label: source.label, reviewPath: source.reviewPath } };
}
