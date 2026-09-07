import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import CheckAvailabilityButton from './CheckAvailabilityButton';
import InstagramPublishButton from './InstagramPublishButton';
import BackButton from './BackButton';

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
    d.publications.some(pub => pub.platform === 'INSTAGRAM' && pub.status === 'PUBLISHED')
  );

  async function updateAffiliateUrl(formData: FormData) {
    'use server';
    const affiliateUrl = formData.get('affiliateUrl') as string;
    const confirmed = formData.get('confirmed') === 'on';

    if (!affiliateUrl || !confirmed) return;

    await prisma.product.update({
      where: { id },
      data: { affiliateUrl, status: 'ACTIVE' },
    });
    
    revalidatePath(`/admin/products/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto">
      <BackButton />
      
      <div className="bg-white dark:bg-gray-900 shadow-md rounded-lg p-6 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{product.title}</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <img src={product.primaryImageUrl || ''} alt={product.title} className="w-full rounded-md object-cover border border-gray-200 dark:border-gray-700" />
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Price</h3>
            <p className="mt-1 text-lg text-gray-900 dark:text-gray-100">${product.price?.toString()} {product.currencyId}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Original Link</h3>
            <a href={product.originalPermalink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
              {product.originalPermalink}
            </a>
          </div>

          <CheckAvailabilityButton productId={product.id} externalId={product.externalId || ''} />
          
          <InstagramPublishButton productId={product.id} isPublished={isPublished} />
        </div>
      </div>

      <form action={updateAffiliateUrl} className="border-t border-gray-200 dark:border-gray-800 pt-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Affiliate Configuration</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Affiliate URL</label>
          <input 
            type="url" 
            name="affiliateUrl" 
            defaultValue={product.affiliateUrl || ''} 
            placeholder="https://mercadolibre.com.ar/..."
            required
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600" 
          />
        </div>

        <div className="mb-4 flex items-start">
          <div className="flex h-5 items-center">
            <input 
              id="confirmed" 
              name="confirmed" 
              type="checkbox" 
              required
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-950" 
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="confirmed" className="font-medium text-gray-700 dark:text-gray-300">Confirmación</label>
            <p className="text-gray-500 dark:text-gray-400">Generé este enlace dentro del Programa de Afiliados. La aplicación no puede garantizar que una venta sea atribuida o comisionable; eso lo determina Mercado Libre.</p>
          </div>
        </div>

        <button 
          type="submit" 
          className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        >
          Save & Activate
        </button>
      </form>
      </div>
    </div>
  );
}
