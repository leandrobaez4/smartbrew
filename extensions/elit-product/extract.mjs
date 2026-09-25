// Self-contained: Chrome serializes this function into an isolated content script.
// It only reads the current product page and does not send or persist data.
export function extractElitProduct() {
  const productMatch = location.pathname.match(/^\/producto\/(\d+)(?:[-/]|$)/);
  if (!['https://www.elit.com.ar', 'https://elit.com.ar'].includes(location.origin) || !productMatch) {
    return { ok: false, message: 'Abrí la página de un producto en elit.com.ar y volvé a probar.' };
  }

  const externalId = productMatch[1];

  function readNextPayload() {
    const chunks = [];
    for (const script of document.querySelectorAll('script')) {
      for (const line of (script.textContent || '').split('\n')) {
        const prefix = 'self.__next_f.push(';
        const start = line.indexOf(prefix);
        if (start < 0 || !line.trimEnd().endsWith(')')) continue;
        try {
          const value = JSON.parse(line.slice(start + prefix.length, line.lastIndexOf(')')));
          if (typeof value?.[1] === 'string') chunks.push(value[1]);
        } catch { /* Ignore unrelated or incomplete Next.js chunks. */ }
      }
    }

    const source = chunks.join('');
    const marker = `\"code\":${externalId}`;
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) return null;

    const preferredStart = source.lastIndexOf('{\"_id\"', markerIndex);
    const start = preferredStart >= 0 ? preferredStart : source.lastIndexOf('{', markerIndex);
    if (start < 0) return null;

    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === '{') depth += 1;
      else if (character === '}' && --depth === 0) {
        try { return JSON.parse(source.slice(start, index + 1)); }
        catch { return null; }
      }
    }
    return null;
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  }

  function cleanImage(raw) {
    try {
      let url = new URL(raw, location.href);
      if (url.origin === location.origin && url.pathname === '/_next/image') {
        url = new URL(url.searchParams.get('url') || '');
      }
      if (url.protocol !== 'https:' || url.origin !== 'https://images.elit.com.ar' || url.username || url.password) return null;
      url.search = '';
      url.hash = '';
      return url.href;
    } catch { return null; }
  }

  function domAttributes() {
    const result = {};
    const anchor = document.querySelector('#caracteristicas');
    const paragraphs = anchor?.nextElementSibling?.querySelectorAll('p') || [];
    const values = [...paragraphs].map((element) => cleanText(element.textContent)).filter(Boolean);
    for (let index = 0; index + 1 < values.length; index += 2) result[values[index]] = values[index + 1];
    return result;
  }

  function finiteNumber(value) {
    const number = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function localizedNumber(value) {
    const compact = cleanText(value).replace(/[^\d.,-]/g, '');
    if (!compact) return null;
    const lastComma = compact.lastIndexOf(',');
    const lastDot = compact.lastIndexOf('.');
    let normalized = compact;
    if (lastComma >= 0 && lastDot >= 0) {
      normalized = lastComma > lastDot
        ? compact.replace(/\./g, '').replace(',', '.')
        : compact.replace(/,/g, '');
    } else if (lastComma >= 0) {
      normalized = /,\d{1,2}$/.test(compact) ? compact.replace(/\./g, '').replace(',', '.') : compact.replace(/,/g, '');
    } else if ((compact.match(/\./g) || []).length > 1) {
      normalized = compact.replace(/\./g, '');
    }
    const number = Number(normalized);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function exchangeRateFromDom() {
    for (const paragraph of document.querySelectorAll('p')) {
      const match = cleanText(paragraph.textContent).match(/^USD\s*\$\s*([\d.,]+)$/i);
      if (match) return localizedNumber(match[1]);
    }
    return null;
  }

  function supplierPriceUsdFromDom() {
    for (const paragraph of document.querySelectorAll('p')) {
      const currency = paragraph.querySelector?.('small');
      if (cleanText(currency?.textContent).toLowerCase() !== 'usd') continue;
      const match = cleanText(paragraph.textContent).match(/^usd\s*\$?\s*([\d.,]+)$/i);
      if (match) return localizedNumber(match[1]);
    }
    return null;
  }

  function vatFromDom() {
    for (const element of document.querySelectorAll('p, small')) {
      const match = cleanText(element.textContent).match(/(?:\+\s*)?IVA\s*([\d.,]+)\s*%/i);
      if (match) return localizedNumber(match[1]);
    }
    return null;
  }

  const source = readNextPayload();
  const fallbackAttributes = domAttributes();
  const title = cleanText(source?.name) || cleanText(document.querySelector('h1')?.textContent) ||
    cleanText(document.querySelector('meta[property="og:title"]')?.getAttribute('content'));
  if (!title) return { ok: false, message: 'No se encontró el título del producto. Recargá la página y volvé a probar.' };

  const images = [];
  const seenImages = new Set();
  function addImage(value) {
    const image = cleanImage(value);
    if (image && !seenImages.has(image)) {
      seenImages.add(image);
      images.push(image);
    }
  }
  for (const media of source?.media?.images || []) addImage(media?.l || media?.m || media?.s);
  if (!images.length) {
    for (const image of document.querySelectorAll('img')) addImage(image.currentSrc || image.getAttribute('src'));
  }
  if (!images.length) addImage(document.querySelector('meta[property="og:image"]')?.getAttribute('content'));

  const attributes = {
    alphanumericCode: cleanText(source?.alfaCode) || fallbackAttributes['Alfanumérico'] || null,
    warranty: cleanText(source?.warranty) ? `${cleanText(source.warranty)} meses` : fallbackAttributes['Garantía'] || null,
    weightKg: finiteNumber(source?.weightReal),
    dimensionsCm: source && [source.width, source.height, source.length].every((value) => finiteNumber(value) !== null)
      ? { width: source.width, height: source.height, length: source.length }
      : fallbackAttributes['Dimensiones'] || null,
    vatPercent: finiteNumber(source?.vat),
    billingGroup: cleanText(source?.billingGroup) || null,
  };

  const numericStock = finiteNumber(source?.stockTotal ?? source?.stock);
  const stock = numericStock === null ? null : Math.trunc(numericStock);
  const supplierPriceUsd = finiteNumber(source?.price) ?? supplierPriceUsdFromDom();
  const exchangeRateArsPerUsd = finiteNumber(source?.currentExchange) || exchangeRateFromDom();
  const vatPercentage = finiteNumber(source?.vat) ?? vatFromDom() ?? localizedNumber(fallbackAttributes.IVA) ?? 0;
  const supplierPriceArs = supplierPriceUsd !== null && exchangeRateArsPerUsd !== null
    ? supplierPriceUsd * exchangeRateArsPerUsd
    : null;
  const vatAmountUsd = supplierPriceUsd === null ? null : supplierPriceUsd * vatPercentage / 100;
  const vatAmountArs = supplierPriceArs === null ? null : supplierPriceArs * vatPercentage / 100;
  const supplierCostWithVatUsd = supplierPriceUsd === null || vatAmountUsd === null ? null : supplierPriceUsd + vatAmountUsd;
  const supplierCostWithVatArs = supplierPriceArs === null || vatAmountArs === null ? null : supplierPriceArs + vatAmountArs;
  const product = {
    supplier: 'elit',
    externalId,
    sku: cleanText(source?.productCode) || fallbackAttributes.SKU || null,
    ean: source?.ean != null ? String(source.ean) : fallbackAttributes.EAN || null,
    title,
    description: cleanText(source?.description) || null,
    brand: cleanText(source?.brand?.title || source?.brand?.name) || null,
    category: cleanText(source?.subCategory?.name) || null,
    cost: supplierCostWithVatArs,
    currency: supplierCostWithVatArs === null ? null : 'ARS',
    stock,
    images: images.slice(0, 20),
    attributes,
    pricing: {
      supplierPriceUsd,
      exchangeRateArsPerUsd,
      supplierPriceArs,
      vatPercentage,
      vatAmountUsd,
      vatAmountArs,
      supplierCostWithVatUsd,
      supplierCostWithVatArs,
    },
    sourceUrl: location.href,
    rawData: {
      code: source?.code ?? Number(externalId),
      price: source?.price ?? null,
      currency: source?.currency ?? null,
      priceCalc: source?.priceCalc ?? null,
      priceCalcType: source?.priceCalcType ?? null,
      currentExchange: source?.currentExchange ?? exchangeRateArsPerUsd,
      stock: source?.stock ?? null,
      stockTotal: source?.stockTotal ?? null,
      stockLevel: source?.stockLevel ?? null,
    },
  };

  const missing = [];
  if (supplierPriceUsd === null) missing.push('precio');
  if (exchangeRateArsPerUsd === null) missing.push('tipo de cambio');
  if (product.stock === null) missing.push('stock');
  return {
    ok: true,
    product,
    message: missing.length
      ? `Producto extraído. Elit no expuso ${missing.join(' ni ')} en esta sesión.`
      : 'Producto extraído con precio y stock.',
  };
}
