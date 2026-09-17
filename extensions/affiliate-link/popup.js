import { requestAffiliateLink } from './request.mjs';

const button = document.querySelector('#generate');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const send = document.querySelector('#send');
let importData;
send.addEventListener('click', async () => {
  if (!importData) return;
  const url = new URL('https://www.smartbrew.tech/admin/products/affiliate');
  url.search = new URLSearchParams(importData).toString();
  await chrome.tabs.create({ url: url.href });
});
button.addEventListener('click', async () => {
  send.disabled = true;
  importData = undefined;
  button.disabled = true;
  result.value = '';
  status.textContent = 'Solicitando enlace…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith('https://www.mercadolibre.com.ar/')) {
      status.textContent = 'Abrí un producto en www.mercadolibre.com.ar y tocá el icono de la extensión.';
      return;
    }
    const [execution] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'ISOLATED', func: requestAffiliateLink });
    const response = execution?.result;
    status.textContent = response?.message || 'No se recibió una respuesta. Revisá Mercado Libre antes de repetir.';
    if (response?.ok) {
      result.value = response.link;
      if (response.product?.title) {
        importData = { ...response.product, affiliateUrl: response.link };
        send.disabled = false;
      }
    }
  } catch {
    status.textContent = 'No se pudo ejecutar o recibir la respuesta. Revisá la pestaña y sus permisos antes de repetir.';
  } finally {
    button.disabled = false;
  }
});
