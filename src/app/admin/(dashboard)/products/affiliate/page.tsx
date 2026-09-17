import { createHash } from 'node:crypto';
import Link from 'next/link';
import { requireAdmin, portalDb } from '@/lib/portal';
import { parseAffiliateImport } from '@/lib/affiliate-import-input';
import ImportForm from './ImportForm';

export default async function AffiliateImportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  let data;
  try { data = parseAffiliateImport(await searchParams); }
  catch { return <p>Datos de importación inválidos. Volvé a enviar el producto desde la extensión.</p>; }
  const product = await portalDb.product.findUnique({ where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: data.externalId } } });
  const id = 'affiliate_' + createHash('sha256').update(`${data.externalId}:${data.affiliateUrl}`).digest('hex');
  const job = await portalDb.jobExecution.findUnique({ where: { id } });
  return <div className="max-w-2xl space-y-5">
    <h1 className="text-2xl font-bold">Importar desde Mercado Libre</h1>
    <p>{data.title} · {data.externalId}</p>
    <p className="break-all">Producto: {data.url}</p>
    <p>Enlace de afiliado: {data.affiliateUrl}</p>
    <p>{data.images.length} fotos recibidas (máximo 20).</p>
    <p>{product ? 'El producto ya existe. Se actualizará el enlace y se agregarán fotos a su galería, conservando su portada y los demás datos.' : 'Se encolará en QStash y se creará como candidato con título, galería y enlace. Precio y disponibilidad quedan pendientes de verificar.'}</p>
    <p>No se publicará en Instagram.</p>
    {job && <p>Último estado del trabajo: {job.status === 'SUCCEEDED' ? 'Completado' : job.status === 'FAILED' ? 'Falló / requiere revisión' : 'Pendiente de procesamiento'}{job.errorMessage ? ` — ${job.errorMessage}` : ''}</p>}
    <ImportForm data={data} existingLink={product?.affiliateUrl || null} />
    <p><Link href={product ? `/admin/products/${product.id}` : '/admin/products'} className="text-blue-600 underline">{product ? 'Ver producto' : 'Ver listado de productos'}</Link></p>
    <p>Actualizá esta página para consultar el resultado de QStash. Si tu sesión venció, iniciá sesión y volvé a enviarlo desde la extensión.</p>
  </div>;
}
