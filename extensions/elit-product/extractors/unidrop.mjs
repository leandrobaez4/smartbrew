// DROP-48 implements the DOM contract. Keeping this function self-contained is
// required because Chrome serializes it into an isolated content script.
export function extractUnidropProduct() {
  if (!['https://www.unidrop.com.ar', 'https://unidrop.com.ar'].includes(location.origin)
    || !/^\/panel\/catalogue\/\d+(?:\/|$)/.test(location.pathname)) {
    return { ok: false, message: 'Abrí una ficha del catálogo de Unidrop y volvé a probar.' };
  }
  return {
    ok: false,
    message: 'SmartBrew reconoció Unidrop, pero el extractor de la ficha todavía no está disponible.',
  };
}
