import { syncMarketplaceStock } from '../src/lib/supplier-stock-sync';

syncMarketplaceStock()
  .then((result) => {
    console.log('Marketplace stock synchronization completed:', result);
    process.exitCode = result.failed > 0 ? 1 : 0;
  })
  .catch((error) => {
    console.error('Marketplace stock synchronization failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
