import { canConfigureProduct, createImportCommand, extractCurrentProduct } from './run.mjs';

const extract = document.querySelector('#extract');
const copy = document.querySelector('#copy');
const send = document.querySelector('#send');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const variantField = document.querySelector('#variant-field');
const variant = document.querySelector('#variant');
let extractedProducts = [];
let extractedProduct;

function encodePayload(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function selectProduct(index) {
  extractedProduct = extractedProducts[index];
  result.value = extractedProduct ? JSON.stringify(extractedProduct, null, 2) : '';
  copy.disabled = !extractedProduct;
  send.disabled = !canConfigureProduct(extractedProduct);
}

extract.addEventListener('click', async () => {
  extract.disabled = true;
  copy.disabled = true;
  send.disabled = true;
  extractedProducts = [];
  extractedProduct = undefined;
  result.value = '';
  variant.replaceChildren();
  variantField.classList.add('hidden');
  try {
    const response = await extractCurrentProduct(chrome, (message) => { status.textContent = message; });
    extractedProducts = Array.isArray(response.products) ? response.products : response.product ? [response.product] : [];
    if (extractedProducts.length > 1) {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Elegí una variante';
      variant.append(placeholder);
      for (const [index, product] of extractedProducts.entries()) {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `${product.sku} · stock ${product.stock}`;
        variant.append(option);
      }
      variantField.classList.remove('hidden');
      selectProduct(-1);
    } else {
      selectProduct(0);
    }
    status.textContent = extractedProducts.length > 1
      ? `${extractedProducts.length} variantes extraídas. Elegí el SKU que querés importar.`
      : response.message;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'No se pudo ejecutar la extensión.';
  } finally {
    extract.disabled = false;
  }
});

variant.addEventListener('change', () => selectProduct(variant.value === '' ? -1 : Number(variant.value)));

send.addEventListener('click', async () => {
  if (!extractedProduct) return;
  send.disabled = true;
  const url = new URL('https://www.smartbrew.tech/admin/suppliers/import');
  url.searchParams.set('payload', encodePayload(createImportCommand(extractedProduct)));
  try {
    await chrome.tabs.create({ url: url.href });
    status.textContent = `SmartBrew abierto para revisar el SKU ${extractedProduct.sku}.`;
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
    status.textContent = 'No se pudo copiar automáticamente. Copiá manualmente el contenido del cuadro.';
  } finally {
    copy.disabled = false;
  }
});
