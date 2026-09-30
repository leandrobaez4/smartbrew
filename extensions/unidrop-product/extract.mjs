// Self-contained: Chrome serializes this function into an isolated content
// script. It reads only the visible product document and never cookies/storage.
export function extractUnidropProduct() {
  if (!['https://www.unidrop.com.ar', 'https://unidrop.com.ar'].includes(location.origin)
    || !/^\/panel\/catalogue\/\d+(?:\/|$)/.test(location.pathname)) {
    return { ok: false, message: 'Abrí una ficha del catálogo de Unidrop y volvé a probar.' };
  }
  const productId = location.pathname.match(/^\/panel\/catalogue\/(\d+)(?:\/|$)/)?.[1];
  const root = document.querySelector('main');
  if (!productId || !root) return { ok: false, message: 'No se encontró la ficha de producto de Unidrop.' };

  function text(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function comparable(value) {
    return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function amount(value) {
    const compact = text(value).replace(/[^\d.,-]/g, '');
    if (!compact) return null;
    const comma = compact.lastIndexOf(',');
    const dot = compact.lastIndexOf('.');
    let normalized = compact;
    if (comma > dot) normalized = compact.replace(/\./g, '').replace(',', '.');
    else if (dot > comma && comma >= 0) normalized = compact.replace(/,/g, '');
    else if (comma >= 0) normalized = /,\d{1,2}$/.test(compact) ? compact.replace(',', '.') : compact.replace(/,/g, '');
    else if ((compact.match(/\./g) || []).length > 1) normalized = compact.replace(/\./g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function labelledAmount(pattern) {
    for (const label of root.querySelectorAll('span')) {
      if (!pattern.test(comparable(label.textContent))) continue;
      const value = label.parentElement?.querySelector('p');
      const parsed = amount(value?.textContent);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function safeImage(value) {
    try {
      const url = new URL(value, location.href);
      if (url.protocol !== 'https:' || url.origin !== 'https://api.unidrop.com.ar' || url.username || url.password) return null;
      url.search = '';
      url.hash = '';
      return url.href;
    } catch {
      return null;
    }
  }

  const variants = [...root.querySelectorAll('p')].flatMap((paragraph) => {
    const match = text(paragraph.textContent).match(/^([A-Za-z0-9][A-Za-z0-9._/-]{0,159})\s*:\s*stock\s*(\d+)$/i);
    return match ? [{ sku: match[1], stock: Number(match[2]) }] : [];
  });
  const costArs = labelledAmount(/^precio (?:de )?(?:mercancia|mercaderia)$/);
  const priceWithProfitArs = labelledAmount(/^precio con ganancia$/);
  const title = text(root.querySelector('h1')?.textContent).replace(/\s*-+\s*$/, '').trim();
  const category = text(root.querySelector('h5')?.textContent) || null;

  const headings = [...root.querySelectorAll('h3')];
  const descriptionHeading = headings.find((heading) => comparable(heading.textContent) === 'descripcion');
  const featuresHeading = headings.find((heading) => comparable(heading.textContent) === 'caracteristicas');
  const description = text(descriptionHeading?.nextElementSibling?.textContent) || null;
  const attributes = {};
  for (const item of featuresHeading?.nextElementSibling?.querySelectorAll('li') || []) {
    const label = text(item.querySelector('strong')?.textContent).replace(/:\s*$/, '');
    const value = text(item.textContent).replace(/^.*?:\s*/, '');
    if (label && value) attributes[label] = value;
  }

  const packageData = { weightGrams: null, heightCm: null, widthCm: null, lengthCm: null };
  for (const row of root.querySelectorAll('tr')) {
    const label = comparable(row.querySelector('strong')?.textContent);
    const value = amount(row.querySelectorAll('td')?.[1]?.textContent);
    if (value === null) continue;
    if (label === 'peso') packageData.weightGrams = value;
    else if (label === 'altura') packageData.heightCm = value;
    else if (label === 'ancho') packageData.widthCm = value;
    else if (label === 'profundidad' || label === 'largo') packageData.lengthCm = value;
  }

  const images = [];
  const seen = new Set();
  for (const image of root.querySelectorAll('img[alt^="main-"]')) {
    const url = safeImage(image.currentSrc || image.getAttribute?.('src'));
    if (url && !seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  }

  let shippingReference = null;
  const shippingParagraph = [...root.querySelectorAll('p')].find((paragraph) => comparable(paragraph.textContent).includes('tienda nube'));
  const shippingAmount = amount(shippingParagraph?.querySelector?.('strong')?.textContent);
  if (shippingAmount !== null) shippingReference = { platform: 'TIENDANUBE', amountArs: shippingAmount };

  const missing = [];
  if (!title) missing.push('título');
  if (!variants.length) missing.push('SKU y stock');
  if (costArs === null) missing.push('precio de mercancía');
  if (missing.length) return { ok: false, message: `No se pudo extraer ${missing.join(', ')} de Unidrop.` };

  const common = {
    version: 1,
    supplier: 'unidrop',
    sourceProductId: productId,
    ean: null,
    title,
    description,
    brand: null,
    category,
    costArs,
    priceWithProfitArs,
    images: images.slice(0, 30),
    package: packageData,
    shippingReference,
    attributes,
    sourceUrl: location.href,
    capturedAt: new Date().toISOString(),
  };
  const products = variants.map((variant) => ({
    ...common,
    externalId: `${productId}:${variant.sku}`,
    sku: variant.sku,
    stock: variant.stock,
  }));

  return {
    ok: true,
    product: products.length === 1 ? products[0] : null,
    products,
    message: products.length === 1
      ? `Producto ${products[0].sku} extraído con costo y stock.`
      : `${products.length} variantes extraídas. Elegí una variante antes de configurar en SmartBrew.`,
  };
}

