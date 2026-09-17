import { requestAffiliateLink } from './request.mjs';
import { collectProductGallery } from './gallery.mjs';

export async function withDeadline(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function generateProduct(chrome, onProgress, deadlines = { tab: 5000, request: 22000, gallery: 5000 }) {
  onProgress('1/3 · Comprobando la pestaña…');
  const [tab] = await withDeadline(chrome.tabs.query({ active: true, currentWindow: true }), deadlines.tab, 'Chrome no respondió al consultar la pestaña. Cerrá el panel y recargá la extensión.');
  if (!tab?.id || !tab.url?.startsWith('https://www.mercadolibre.com.ar/')) {
    throw Error('Abrí un producto en www.mercadolibre.com.ar y tocá el icono de la extensión.');
  }
  onProgress('2/3 · Solicitando el enlace a Mercado Libre…');
  const [execution] = await withDeadline(chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: requestAffiliateLink }), deadlines.request,
    'Chrome no devolvió el resultado a tiempo. La solicitud podría haberse procesado: revisá Mercado Libre antes de repetir. Recargá la página si sigue bloqueada.');
  const response = execution?.result;
  if (!response?.ok) throw Error(response?.message || 'No se recibió una respuesta. Revisá Mercado Libre antes de repetir.');
  if (!response.product?.title) return { ...response, warning: 'Se generó el enlace, pero falta el título del producto. No se puede enviar a SmartBrew.' };
  onProgress('3/3 · Enlace generado. Leyendo la galería…');
  let images = response.product.image ? [response.product.image] : [];
  let warning = '';
  try {
    const [gallery] = await withDeadline(chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: collectProductGallery }), deadlines.gallery, 'gallery timeout');
    if (gallery?.error || !Array.isArray(gallery?.result)) throw Error('gallery unavailable');
    if (gallery.result.length) images = gallery.result;
  } catch {
    warning = 'No se pudo leer la galería. Podés enviar el producto con la portada y agregar las fotos más adelante.';
  }
  return { ...response, product: { ...response.product, image: images[0] || '' }, images, warning };
}
