import { generateProduct, withDeadline } from './generate.mjs';

const button = document.querySelector('#generate');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const send = document.querySelector('#send');
let importData;
send.addEventListener('click', async () => {
  if (!importData) return;
  const url = new URL('https://www.smartbrew.tech/admin/products/affiliate');
  url.search = new URLSearchParams(importData).toString();
  send.disabled = true;
  try {
    await withDeadline(chrome.tabs.create({ url: url.href }), 5000, 'No se pudo confirmar la apertura de SmartBrew.');
  } catch { status.textContent = 'No se pudo confirmar la apertura de SmartBrew. Revisá si se abrió una pestaña antes de repetir.'; }
  finally { send.disabled = false; }
});
button.addEventListener('click', async () => {
  send.disabled = true;
  importData = undefined;
  button.disabled = true;
  result.value = '';
  status.textContent = 'Solicitando enlace…';
  try {
    const response = await generateProduct(chrome, message => { status.textContent = message; });
    result.value = response.link;
    status.textContent = response.warning || `${response.message} Fotos detectadas: ${response.images?.length || 0}.`;
    if (response.product?.title) {
      importData = { ...response.product, affiliateUrl: response.link, images: JSON.stringify(response.images || []) };
      send.disabled = false;
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo ejecutar la extensión. Recargá la página y la extensión antes de repetir.';
  } finally {
    button.disabled = false;
  }
});
