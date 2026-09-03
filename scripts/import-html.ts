import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { calculateOpportunityScore } from '../src/lib/domain/scoring';

const prisma = new PrismaClient();

async function main() {
  console.log('Buscando importaciones HTML pendientes en la base de datos...');
  
  const pendingJobs = await prisma.htmlImportJob.findMany({
    where: { 
      status: { in: ['PENDING', 'ERROR'] } 
    }
  });

  if (pendingJobs.length === 0) {
    console.log('No hay archivos pendientes de procesar.');
    process.exit(0);
  }

  console.log(`¡Se encontraron ${pendingJobs.length} trabajos pendientes!`);

  for (const job of pendingJobs) {
    console.log(`\n======================================================`);
    console.log(`Procesando archivo: ${job.filename}`);
    
    await prisma.htmlImportJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', errorMessage: null }
    });

    try {
      const filePath = path.resolve(process.cwd(), 'storage/imports', job.filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`No se encontró el archivo físico: ${filePath}`);
      }

      const html = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(html);
      const items = $('.ui-search-layout__item');
      
      let productsFound = 0;
      let processed = 0;
      
      console.log(`Analizando el HTML directo (encontrados ${items.length} nodos)...`);
      
      for (let i = 0; i < items.length; i++) {
        const itemEl = items.eq(i);
        
        // Extraer link
        const href = itemEl.find('a').attr('href') || '';
        const idMatch = href.match(/MLA-?(\d+)/i);
        
        if (!idMatch) continue;
        
        const id = `MLA${idMatch[1]}`;
        
        // Filter out category IDs (usually 4-5 digits). Real items have 8+ digits.
        if (id.length < 10) continue;
        
        productsFound++;

        // Extraer Título (de la imagen principal)
        const imgEl = itemEl.find('img.poly-component__picture');
        const title = imgEl.attr('alt') || 'Producto Importado';
        
        // Extraer Imagen
        let imgUrl = imgEl.attr('src');
        const srcSet = imgEl.attr('srcset');
        if (srcSet) {
           const firstSet = srcSet.split(',')[0].trim().split(' ')[0];
           if (firstSet.startsWith('http')) imgUrl = firstSet;
        }
        
        // Extraer Precio (ultimo elemento suele ser el precio final con descuento)
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
            sellerReputation: 'good', // Asumido
            hasStock: true, // Si está en la búsqueda, tiene stock
            hasFastShipping: true,
            salesCount: 100, // Asumido
            rating: 4.5, // Asumido
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
                categoryId: 'MLA1000', // Default
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
            console.log(`✅ [${processed}] Importado: ${title.substring(0, 40)}... ($${price})`);
            
            if (processed % 5 === 0) {
              await prisma.htmlImportJob.update({
                where: { id: job.id },
                data: { productsImported: processed }
              });
            }
          } else {
            console.log(`❌ Descartado (Puntaje bajo): ${title}`);
          }
        } catch (err: any) {
          console.error(`Error guardando ${id}:`, err.message);
        }
      }

      await prisma.htmlImportJob.update({
        where: { id: job.id },
        data: { 
          status: 'COMPLETED', 
          productsFound: productsFound,
          productsImported: processed 
        }
      });
      console.log(`¡Trabajo de importación completado! Se guardaron ${processed} productos de ${productsFound} detectados.`);
      
    } catch (err: any) {
      console.error(`Error procesando trabajo ${job.id}:`, err.message);
      await prisma.htmlImportJob.update({
        where: { id: job.id },
        data: { status: 'ERROR', errorMessage: err.message }
      });
    }
  }

  console.log('\nTodos los archivos pendientes fueron procesados.');
}

main().catch(console.error);
