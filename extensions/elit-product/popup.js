import { extractCurrentProduct } from './run.mjs';

const extract = document.querySelector('#extract');
const copy = document.querySelector('#copy');
const send = document.querySelector('#send');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
let extractedProduct;

function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

extract.addEventListener('click', async () => {
  extract.disabled = true;
  copy.disabled = true;
  send.disabled = true;
  extractedProduct = undefined;
  result.value = '';
  try {
    const response = await extractCurrentProduct(chrome, (message) => { status.textContent = message; });
    result.value = JSON.stringify(response.product, null, 2);
    extractedProduct = response.product;
    status.textContent = response.message;
    copy.disabled = false;
    send.disabled = !response.product.pricing?.supplierPriceUsd || !response.product.pricing?.exchangeRateArsPerUsd;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo ejecutar la extensión.';
  } finally {
    extract.disabled = false;
  }
});

send.addEventListener('click', async () => {
  if (!extractedProduct) return;
  send.disabled = true;
  const url = new URL('https://www.smartbrew.tech/admin/suppliers/elit-import');
  url.searchParams.set('payload', encodePayload(extractedProduct));
  try {
    await chrome.tabs.create({ url: url.href });
    status.textContent = 'SmartBrew abierto para revisar los cálculos y confirmar el guardado.';
  } catch {
    status.textContent = 'No se pudo abrir SmartBrew. Revisá si la pestaña se abrió antes de repetir.';
  } finally {
    send.disabled = false;
  }
});

copy.addEventListener('click', async () => {
  if (!result.value) return;
  copy.disabled = true;
  try {
    await navigator.clipboard.writeText(result.value);
    status.textContent = 'JSON copiado. La extracción no se guardó en SmartBrew.';
  } catch {
    status.textContent = 'No se pudo copiar automáticamente. Seleccioná el contenido del cuadro y copialo manualmente.';
  } finally {
    copy.disabled = false;
  }
});
