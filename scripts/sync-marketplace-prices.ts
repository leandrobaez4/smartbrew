import { syncMarketplacePrices } from '../src/lib/supplier-price-sync';

syncMarketplacePrices()
  .then((result) => {
    console.log('Marketplace price synchronization completed:', result);
    process.exitCode = result.failed > 0 ? 1 : 0;
  })
  .catch((error) => {
    console.error('Marketplace price synchronization failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
