import { normalizeInstagramImage, isAllowedInstagramImageSource, verifyInstagramImageSignature } from '../../../../lib/instagram-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const sourceUrl = requestUrl.searchParams.get('url') || '';
  const signature = requestUrl.searchParams.get('sig') || '';
  const secret = process.env.INSTAGRAM_IMAGE_PROXY_SECRET || process.env.INSTAGRAM_ACCESS_TOKEN || '';

  if (!secret) return errorResponse('Servicio de imágenes no configurado.', 503);
  if (!isAllowedInstagramImageSource(sourceUrl)) return errorResponse('Origen de imagen no permitido.', 400);
  if (!verifyInstagramImageSignature(sourceUrl, signature, secret)) return errorResponse('Firma inválida.', 403);

  let source: Response;
  try {
    source = await fetch(sourceUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
    });
  } catch {
    return errorResponse('No se pudo descargar la imagen.', 502);
  }

  if (!source.ok) return errorResponse('El origen rechazó la imagen.', 502);
  const contentType = source.headers.get('content-type')?.split(';', 1)[0].toLowerCase() || '';
  if (!['image/avif', 'image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return errorResponse('El origen no devolvió una imagen compatible.', 415);
  }
  const contentLength = Number(source.headers.get('content-length') || 0);
  if (contentLength > MAX_SOURCE_BYTES) return errorResponse('La imagen supera el límite permitido.', 413);

  const bytes = new Uint8Array(await source.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > MAX_SOURCE_BYTES) return errorResponse('La imagen supera el límite permitido.', 413);

  try {
    const normalized = await normalizeInstagramImage(bytes);
    return new Response(new Uint8Array(normalized), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return errorResponse('No se pudo procesar la imagen.', 422);
  }
}
