'use server';

import { PrismaClient } from '@prisma/client';
import { MercadoLibreClient } from '@/lib/domain/ml-client';
import { calculateOpportunityScore } from '@/lib/domain/scoring';
import { redirect } from 'next/navigation';

const prisma = new PrismaClient();
const ml = new MercadoLibreClient();

export async function importProductAction(prevState: { error: string | null }, formData: FormData) {
  const urlOrId = formData.get('mlUrl') as string;
  if (!urlOrId) {
    return { error: 'Por favor ingresá un link o ID válido.' };
  }

  // Extract ID from URL like https://articulo.mercadolibre.com.ar/MLA-1406085189-...
  // Or just accept MLA1406085189 directly.
  const match = urlOrId.match(/MLA-?(\d+)/i);
  let externalId = urlOrId.trim();
  
  if (match) {
    externalId = `MLA${match[1]}`;
  } else if (!externalId.startsWith('MLA')) {
    return { error: 'No se pudo detectar un ID válido de Mercado Libre Argentina (ej: MLA12345678).' };
  }

  try {
    const item = await ml.getProduct(externalId);
    
    // Fake AI input for imported products (always forces at least manual review)
    const scoreInput = {
      price: item.price || 0,
      categoryPercentiles: { p35: 0, p70: 9999999 }, // Fake percentiles to always pass price check
      sellerReputation: item.sellerReputation || 'good',
      hasStock: item.isAvailable,
      hasFastShipping: !!item.hasFastShipping,
      salesCount: item.salesCount || 10,
      rating: 4.5, 
      problemSolvedLevel: 'CLEAR_AND_DAILY' as const,
      problemSolvedDescription: 'Importado manualmente',
      explanationDifficulty: 'EASY' as const,
      reelHook: `Revisá este ${item.title}...`,
      hasContentPotential: true
    };
    
    const scoreResult = calculateOpportunityScore(scoreInput);
    
    await prisma.product.upsert({
      where: {
        marketplace_externalId: {
          marketplace: 'MERCADO_LIBRE',
          externalId: item.externalId
        }
      },
      update: {
        price: item.price,
        status: 'CANDIDATE',
        opportunityScore: scoreResult.opportunityScore,
        priceTier: scoreResult.priceTier,
        problemSolved: scoreResult.problemSolved,
        reelHook: scoreResult.reelHook,
        explanationDifficulty: scoreResult.explanationDifficulty,
        selectionReasons: ['Importado manualmente', ...(scoreResult.selectionReasons as any)],
        lastMarketplaceSyncAt: new Date()
      },
      create: {
        marketplace: 'MERCADO_LIBRE',
        externalId: item.externalId,
        siteId: 'MLA',
        title: item.title,
        categoryId: item.categoryId,
        price: item.price,
        currencyId: item.currencyId,
        originalPermalink: item.originalPermalink,
        primaryImageUrl: item.primaryImageUrl,
        sellerId: item.sellerId,
        sellerReputation: item.sellerReputation,
        status: 'CANDIDATE',
        opportunityScore: scoreResult.opportunityScore,
        priceTier: scoreResult.priceTier,
        problemSolved: scoreResult.problemSolved,
        reelHook: scoreResult.reelHook,
        explanationDifficulty: scoreResult.explanationDifficulty,
        selectionReasons: ['Importado manualmente', ...(scoreResult.selectionReasons as any)],
        lastMarketplaceSyncAt: new Date()
      }
    });

  } catch (err: any) {
    console.error(err);
    return { error: 'Error al importar de Mercado Libre: ' + err.message };
  }

  redirect('/admin/products');
}
