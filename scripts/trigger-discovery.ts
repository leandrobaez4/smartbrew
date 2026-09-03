import { Queue } from 'bullmq';
import Redis from 'ioredis';

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue('affiliate-jobs', { connection });

  console.log('Enqueuing discover-products job...');
  await queue.add('discover-products', {});
  console.log('Job enqueued! The worker will process it shortly.');
  
  process.exit(0);
}

main().catch(console.error);
