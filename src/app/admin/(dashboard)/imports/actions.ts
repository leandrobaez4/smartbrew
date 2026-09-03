'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import * as fs from 'fs';
import * as path from 'path';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue('affiliate-jobs', { connection });

export async function uploadHtmlAction(prevState: { error: string | null }, formData: FormData) {
  const file = formData.get('htmlFile') as File;
  
  if (!file || file.size === 0) {
    return { error: 'Por favor, seleccioná un archivo HTML válido.' };
  }
  
  if (!file.name.endsWith('.html')) {
    return { error: 'El archivo debe tener extensión .html' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
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

    await queue.add('process-html-import', {
      jobId: importJob.id,
      filePath: filePath
    });

    revalidatePath('/admin/imports');
    return { error: null, success: true };
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return { error: 'Ocurrió un error al procesar el archivo: ' + error.message };
  }
}
