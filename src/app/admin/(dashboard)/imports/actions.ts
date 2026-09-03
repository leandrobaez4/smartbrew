'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { calculateOpportunityScore } from '@/lib/domain/scoring';

const prisma = new PrismaClient();

// Lazy initialization of Redis Queue to avoid connecting if not needed
let queue: Queue | null = null;
function getQueue() {
  if (!queue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue('affiliate-jobs', { connection });
  }
  return queue;
}

export async function uploadHtmlAction(prevState: { error: string | null }, formData: FormData) {
  const file = formData.get('htmlFile') as File;
  
  if (!file || file.size === 0) {
    return { error: 'Por favor, seleccioná un archivo HTML válido.' };
  }
  
  if (!file.name.endsWith('.html')) {
    return { error: 'El archivo debe tener extensión .html' };
  }

  const useRedisQueue = process.env.QUEUE_DRIVER === 'redis';

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (useRedisQueue) {
      // ===== LÓGICA REDIS (BACKGROUND) =====
      const storageDir = path.resolve(process.cwd(), 'storage/imports');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }

      const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(storageDir, uniqueFilename);
      fs.writeFileSync(filePath, buffer);

      const importJob = await prisma.htmlImportJob.create({
        data: {
          filename: uniqueFilename,
          status: 'PENDING'
        }
      });

      const q = getQueue();
      await q.add('process-html-import', {
        jobId: importJob.id,
        filePath: filePath
      });

      revalidatePath('/admin/imports');
      return { error: null, success: true, message: 'Enviado a procesar en segundo plano' };

    } else {
      // ===== LÓGICA MEMORIA (SERVERLESS / SYNC) =====
      const htmlString = buffer.toString('utf-8');
      
      const importJob = await prisma.htmlImportJob.create({
        data: {
          filename: file.name,
          status: 'PROCESSING'
        }
      });

      const $ = cheerio.load(htmlString);
      const items = $('.ui-search-layout__item');
      
      let productsFound = 0;
      let processed = 0;
      
      for (let i = 0; i < items.length; i++) {
        const itemEl = items.eq(i);
        const href = itemEl.find('a').attr('href') || '';
        const idMatch = href.match(/MLA-?(\d+)/i);
        if (!idMatch) continue;
        
        const id = `MLA${idMatch[1]}`;
        if (id.length < 10) continue;
        
        productsFound++;

        const imgEl = itemEl.find('img.poly-component__picture');
        const title = imgEl.attr('alt') || 'Producto Importado';
        
        let imgUrl = imgEl.attr('src');
        const srcSet = imgEl.attr('srcset');
        if (srcSet) {
           const firstSet = srcSet.split(',')[0].trim().split(' ')[0];
           if (firstSet.startsWith('http')) imgUrl = firstSet;
        }
        
        const priceEls = itemEl.find('.andes-money-amount__fraction');
        let price = 0;
        if (priceEls.length > 0) {
           const priceText = priceEls.last().text().replace(/\./g, '');
           price = parseInt(priceText, 10) || 0;
        }

        try {
          const scoreInput = {
            price: price,
            categoryPercentiles: { p35: 0, p70: 999999 },
            sellerReputation: 'good',
            hasStock: true,
            hasFastShipping: true,
            salesCount: 100,
            rating: 4.5,
            problemSolvedLevel: 'CLEAR_AND_DAILY' as const,
            problemSolvedDescription: 'Importado por HTML',
            explanationDifficulty: 'EASY' as const,
            reelHook: `Este producto cambia tu setup...`,
            hasContentPotential: true
          };
          
          const scoreResult = calculateOpportunityScore(scoreInput);
          
          if (scoreResult.status === 'SELECTED' || scoreResult.status === 'MANUAL_REVIEW') {
            await prisma.product.upsert({
              where: { marketplace_externalId: { marketplace: 'MERCADO_LIBRE', externalId: id } },
              update: {
                price: price,
                status: scoreResult.status === 'SELECTED' ? 'ACTIVE' : 'CANDIDATE',
                opportunityScore: scoreResult.opportunityScore,
                primaryImageUrl: imgUrl,
              },
              create: {
                marketplace: 'MERCADO_LIBRE',
                externalId: id,
                siteId: 'MLA',
                title: title,
                categoryId: 'MLA1000',
                price: price,
                currencyId: 'ARS',
                originalPermalink: href,
                primaryImageUrl: imgUrl,
                sellerId: '1',
                sellerReputation: 'good',
                status: scoreResult.status === 'SELECTED' ? 'ACTIVE' : 'CANDIDATE',
                opportunityScore: scoreResult.opportunityScore,
                priceTier: scoreResult.priceTier,
                problemSolved: scoreResult.problemSolved,
                reelHook: scoreResult.reelHook,
                explanationDifficulty: scoreResult.explanationDifficulty,
                selectionReasons: ['Importado vía HTML', ...(scoreResult.selectionReasons as any)],
                lastMarketplaceSyncAt: new Date()
              }
            });
            processed++;
          }
        } catch (err: any) {
          console.error(`Error procesando item ${id}:`, err);
        }
      }

      await prisma.htmlImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'COMPLETED',
          productsFound: productsFound,
          productsImported: processed
        }
      });

      revalidatePath('/admin/imports');
      revalidatePath('/admin/products');
      
      return { error: null, success: true, message: 'Procesado en memoria exitosamente' };
    }
  } catch (error: any) {
    console.error('Error procesando archivo HTML:', error);
    return { error: 'Ocurrió un error al procesar el archivo: ' + error.message };
  }
}
