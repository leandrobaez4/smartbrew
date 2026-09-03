import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

console.log('Worker connecting to Redis...', redisUrl);

const worker = new Worker('affiliate-jobs', async job => {
  console.log(`Processing job ${job.id} of type ${job.name}`);
  
  if (job.name === 'discover-products') {
    console.log('Running real discover products job...');
    const MLClient = require('./lib/domain/ml-client').MercadoLibreClient;
    const { calculateOpportunityScore } = require('./lib/domain/scoring');
    const ml = new MLClient();
    
    // Niche search (e.g., tech gadgets, coffee accessories)
    const keywords = [
      'gadgets tecnologia', 
      'accesorios tecnologia', 
      'gadgets cafe', 
      'accesorios cafe', 
      'barista', 
      'smart home'
    ];
    const query = keywords[Math.floor(Math.random() * keywords.length)];
    console.log(`Searching ML for: ${query}`);
    
    try {
      const ids = await ml.scrapeProductIds(query, 10); // get top 10 to not blast ML
      console.log(`Found ${ids.length} product IDs via scraping.`);
      
      const results = [];
      for (const id of ids) {
        try {
          // Wait 1 second between API calls to avoid rate limiting
          await new Promise(res => setTimeout(res, 1000));
          const item = await ml.getProduct(id);
          results.push(item);
        } catch (err) {
          console.error(`Error fetching details for ${id}:`, err);
        }
      }
      
      // Calculate basic percentiles from the current batch for simulation
      const prices = results.map((r: any) => r.price || 0).sort((a: number, b: number) => a - b);
      const p35 = prices[Math.floor(prices.length * 0.35)] || 0;
      const p70 = prices[Math.floor(prices.length * 0.70)] || 0;
      
      let processed = 0;
      for (const item of results) {
        // OpenAI Fake Simulation for problem solved/difficulty
        // In production, you would batch-call OpenAI for these insights.
        const scoreInput = {
          price: item.price || 0,
          categoryPercentiles: { p35, p70 },
          sellerReputation: item.sellerReputation || 'good',
          hasStock: item.isAvailable,
          hasFastShipping: !!item.hasFastShipping,
          salesCount: item.salesCount || 10,
          rating: 4.5, // ML search doesn't return ratings easily, assumed 4.5
          problemSolvedLevel: 'CLEAR_AND_DAILY' as const, // Fake AI
          problemSolvedDescription: 'Resuelve un problema cotidiano',
          explanationDifficulty: 'EASY' as const, // Fake AI
          reelHook: `Este producto cambia tu ${query}...`,
          hasContentPotential: true
        };
        
        const scoreResult = calculateOpportunityScore(scoreInput);
        
        if (scoreResult.status === 'SELECTED' || scoreResult.status === 'MANUAL_REVIEW') {
          await prisma.product.upsert({
            where: {
              marketplace_externalId: {
                marketplace: 'MERCADO_LIBRE',
                externalId: item.externalId
              }
            },
            update: {
              price: item.price,
              status: scoreResult.status === 'SELECTED' ? 'ACTIVE' : 'CANDIDATE',
              opportunityScore: scoreResult.opportunityScore,
              priceTier: scoreResult.priceTier,
              problemSolved: scoreResult.problemSolved,
              reelHook: scoreResult.reelHook,
              explanationDifficulty: scoreResult.explanationDifficulty,
              selectionReasons: scoreResult.selectionReasons as any,
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
              status: scoreResult.status === 'SELECTED' ? 'ACTIVE' : 'CANDIDATE',
              opportunityScore: scoreResult.opportunityScore,
              priceTier: scoreResult.priceTier,
              problemSolved: scoreResult.problemSolved,
              reelHook: scoreResult.reelHook,
              explanationDifficulty: scoreResult.explanationDifficulty,
              selectionReasons: scoreResult.selectionReasons as any,
              lastMarketplaceSyncAt: new Date()
            }
          });
          processed++;
        }
      }
      console.log(`Discovery complete. Processed and saved ${processed} products.`);
    } catch (error) {
      console.error('Error fetching ML:', error);
      return { success: false, error: (error as Error).message };
    }
    
    return { success: true };
  }

  if (job.name === 'generate-copy') {
    const draftId = job.data.draftId;
    console.log(`Generating copy for draft ${draftId}...`);
    
    try {
      const draft = await prisma.contentDraft.findUnique({
        where: { id: draftId },
        include: { product: true }
      });
      
      if (!draft || !draft.product) throw new Error('Draft or Product not found');
      
      const OpenAICopyGenerator = require('./lib/domain/openai-client').OpenAICopyGenerator;
      const generator = new OpenAICopyGenerator();
      
      const copy = await generator.generate({
        productTitle: draft.product.title,
        productPrice: draft.product.price ? Number(draft.product.price) : null,
        productCurrency: draft.product.currencyId,
        productAttributes: draft.product.selectionReasons
      });
      
      await prisma.contentDraft.update({
        where: { id: draftId },
        data: {
          status: 'READY',
          hook: copy.hook,
          benefitsJson: copy.benefits,
          caption: copy.caption,
          cta: copy.cta,
          hashtagsJson: copy.hashtags,
          disclaimer: copy.disclaimer
        }
      });
      console.log(`Copy generated successfully for draft ${draftId}`);
    } catch (err: any) {
      console.error('Error generating copy:', err.message);
      return { success: false, error: err.message };
    }
    
    return { success: true };
  }

  if (job.name === 'render-reel') {
    const draftId = job.data.draftId;
    console.log(`Rendering reel for draft ${draftId}...`);
    // Fake render: just update status
    await prisma.contentDraft.update({
      where: { id: draftId },
      data: { status: 'APPROVED' } // MVP simplify
    });
    return { success: true };
  }

  if (job.name === 'publish-instagram') {
    const draftId = job.data.draftId;
    console.log(`Publishing to Instagram for draft ${draftId}...`);
    await prisma.contentDraft.update({
      where: { id: draftId },
      data: { status: 'PUBLISHED' }
    });
    return { success: true };
  }

}, { connection });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
