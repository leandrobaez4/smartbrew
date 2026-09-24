import { PrismaClient, ProductStatus } from '@prisma/client';
import Link from 'next/link';
import ProductTable from './ProductTable';
import { parseProductSort, parseSortDirection, productListQuery } from '@/lib/product-list';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ page?: string, search?: string, status?: string, sort?: string, direction?: string }> }) {
  const sp = await searchParams;
  const requestedPage = Number(sp.page || '1');
  const sort = parseProductSort(sp.sort);
  const direction = parseSortDirection(sp.direction);
  const limit = 20;

  const where: any = {};
  if (sp.search) {
    where.title = { contains: sp.search, mode: 'insensitive' };
  }
  if (sp.status && Object.values(ProductStatus).includes(sp.status as ProductStatus)) {
    where.status = sp.status as ProductStatus;
  }

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(totalPages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const skip = (page - 1) * limit;
  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(productListQuery(sp.search || '', where.status || '', sort, direction, skip, limit));
  const productsRaw = await prisma.product.findMany({
      where: { id: { in: orderedIds.map(p => p.id) } },
      include: {
        drafts: {
          include: {
            publications: true
          }
        }
      }
    });

  // Mapeamos para determinar si está publicado en Instagram
  const positions = new Map(orderedIds.map((p, index) => [p.id, index]));
  const jobs = await prisma.jobExecution.findMany({ where: { jobName: 'instagram_product_publish', entityId: { in: orderedIds.map(p => p.id) } }, orderBy: { startedAt: 'desc' }, distinct: ['entityId'] });
  const jobsByProduct = new Map(jobs.map(job => [job.entityId, job]));
  const products = productsRaw.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!).map(p => {
    // Revisar si tiene alguna publicacion con status PUBLISHED en algun draft
    const isPublished = p.drafts.some(d => 
      d.publications.some(pub => pub.platform === 'INSTAGRAM' && pub.status === 'PUBLISHED' && !pub.deletedAt)
    );

    return {
      id: p.id,
      title: p.title,
      externalId: p.externalId,
      marketplace: p.marketplace,
      status: p.status,
      price: p.price ? Number(p.price) : null,
      currencyId: p.currencyId,
      primaryImageUrl: p.primaryImageUrl,
      originalPermalink: p.originalPermalink,
      affiliateUrl: p.affiliateUrl,
      createdAt: p.createdAt,
      category: p.category,
      queueStatus: jobsByProduct.get(p.id)?.status || null,
      queueError: jobsByProduct.get(p.id)?.errorMessage || null,
      queueNeedsReview: Boolean(jobsByProduct.get(p.id)?.outputJson && jobsByProduct.get(p.id)?.status === 'STARTED' && Date.now() - jobsByProduct.get(p.id)!.startedAt.getTime() > 180000),
      isPublished,
      instagramPublications: p.drafts.flatMap(d => d.publications).filter(pub => pub.platform === 'INSTAGRAM' && pub.status === 'PUBLISHED' && !pub.deletedAt).map(pub => ({ id: pub.id, mediaId: pub.externalMediaId })),
      instagramBlocked: p.drafts.some(d => d.publications.some(pub => pub.platform === 'INSTAGRAM' && !pub.deletedAt && ['QUEUED', 'UPLOADING', 'PROCESSING'].includes(pub.status))),
      imageUrls: p.imageUrls
    };
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Productos</h1>
        <Link href="/admin/products/import" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Importar Producto
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-800">
        <form method="GET" className="flex gap-4 items-end">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="direction" value={direction} />
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Buscar</label>
            <input type="text" name="search" defaultValue={sp.search} className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:ring-blue-500 focus:border-blue-500" placeholder="Buscar por título..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Estado</label>
            <select name="status" defaultValue={sp.status || 'ALL'} className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md p-2 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500">
              <option value="ALL">Todos</option>
              <option value="CANDIDATE">Candidatos</option>
              <option value="ACTIVE">Activos</option>
              <option value="PAUSED">Pausados</option>
              <option value="ARCHIVED">Archivados</option>
            </select>
          </div>
          <div>
            <button type="submit" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold px-6 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Filtrar
            </button>
          </div>
        </form>
      </div>

      <ProductTable 
        key={`${page}:${sp.search || ''}:${sp.status || ''}:${sort}:${direction}`}
        sort={sort}
        direction={direction}
        products={products}
        total={total}
        page={page}
        totalPages={totalPages}
        search={sp.search || ''}
        statusFilter={sp.status || ''}
      />
    </div>
  );
}
