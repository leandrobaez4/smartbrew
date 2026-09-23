import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import AffiliateConfiguration from '../AffiliateConfiguration';
import ProductPublicLink from '../ProductPublicLink';
import ProductAdForm from '../ProductAdForm';
import ProductImageEditor from '../ProductImageEditor';
import { safeAffiliateUrl } from '@/lib/product-url';
import CheckAvailabilityButton from './CheckAvailabilityButton';
import InstagramPublishButton from './InstagramPublishButton';
import BackButton from './BackButton';
import InstagramReconciliation from './InstagramReconciliation';
import FacebookInstagramVerification from './FacebookInstagramVerification';
import RegenerateEditorialButton from './RegenerateEditorialButton';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ 
    where: { id },
    include: {
      drafts: {
        include: {
          publications: true
        }
      }
    }
  });

  if (!product) {
    notFound();
  }

  const isPublished = product.drafts.some(d => 
    d.publications.some(pub => pub.platform === 'INSTAGRAM' && pub.status === 'PUBLISHED' && !pub.deletedAt)
  );

  const pendingJob = await prisma.jobExecution.findFirst({ where: { jobName: 'instagram_product_publish', entityId: id, status: 'STARTED' }, select: { id: true } });
  const instagramBlocked = Boolean(pendingJob) || product.drafts.some(d => d.publications.some(pub => pub.platform === 'INSTAGRAM' && !pub.deletedAt && ['QUEUED', 'UPLOADING', 'PROCESSING'].includes(pub.status)));

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton />
      
      <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{product.title}</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <ProductImageEditor productId={product.id} title={product.title} primaryImageUrl={product.primaryImageUrl} imageUrls={product.imageUrls} />
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Precio</h3>
            <p className="mt-1 text-lg text-gray-900 dark:text-gray-100">${product.price?.toString()} {product.currencyId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Enlace Original de Mercado Libre</h3>
            <a href={product.originalPermalink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
              {product.originalPermalink}
            </a>
          </div>

          <CheckAvailabilityButton productId={product.id} externalId={product.externalId || ''} />
          <RegenerateEditorialButton productId={product.id} aiStatus={product.aiStatus} aiError={product.aiError} />
          
          <InstagramPublishButton productId={product.id} isPublished={isPublished} blocked={instagramBlocked} canPublish={Boolean(product.affiliateUrl && product.primaryImageUrl)} />
          {product.drafts.flatMap(d => d.publications).filter(pub => pub.platform === 'INSTAGRAM' && pub.status === 'PUBLISHED' && !pub.deletedAt).map(pub => (
            <InstagramReconciliation key={pub.id} productId={product.id} publicationId={pub.id} mediaId={pub.externalMediaId} />
          ))}
        </div>
      </div>

      <FacebookInstagramVerification productId={product.id} publications={product.drafts.flatMap(d => d.publications).filter(p => p.platform === 'INSTAGRAM' && p.status === 'PUBLISHED' && !p.deletedAt).map(p => ({ id: p.id, mediaId: p.externalMediaId }))} />
      <AffiliateConfiguration key={product.affiliateUrl} productId={product.id} affiliateUrl={product.affiliateUrl} />
      <ProductPublicLink productId={product.id} available={product.status === 'ACTIVE' && Boolean(safeAffiliateUrl(product.affiliateUrl))} />
      <ProductAdForm productId={product.id} />
      </div>
    </div>
  );
}
