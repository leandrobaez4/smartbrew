import { Client } from '@upstash/qstash';
import { PrismaClient } from '@prisma/client';
import { logSystemEvent } from '@/lib/logger';
import { processInstagramComment, processInstagramDirectMessage } from '@/lib/instagram-bot';

const prisma = new PrismaClient();

export type InstagramJobType = 'comment' | 'dm';

export interface InstagramJobPayload {
  type: InstagramJobType;
  data: any;
  createdAt: string;
}

/**
 * Encola una tarea para responder un comentario o un DM de Instagram
 * Soporta dos drivers configurables: 'qstash' o 'db'
 */
export async function enqueueInstagramJob(type: InstagramJobType, data: any) {
  const driver = process.env.INSTAGRAM_QUEUE_DRIVER || 'qstash';
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = process.env.APP_URL || 'https://smartbrew-baez3.vercel.app';
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const destinationUrl = bypassSecret 
    ? `${appUrl}/api/queue/instagram-process?x-vercel-protection-bypass=${bypassSecret}`
    : `${appUrl}/api/queue/instagram-process`;

  const payload: InstagramJobPayload = {
    type,
    data,
    createdAt: new Date().toISOString()
  };

  // 1. DRIVER: QSTASH (Recomendado para Vercel Serverless)
  if (driver === 'qstash') {
    if (!qstashToken) {
      console.warn('[Queue] Driver QStash seleccionado pero falta QSTASH_TOKEN en .env. Fallback automático a driver DB.');
    } else {
      try {
        const client = new Client({ 
          token: qstashToken,
          baseUrl: process.env.QSTASH_URL || undefined,
        });
        const headers: Record<string, string> = {};
        if (bypassSecret) {
          headers['x-vercel-protection-bypass'] = bypassSecret;
        }

        // Publicamos a QStash con retardo de 2 segundos para evitar rate-limits de Meta y simular respuesta humana
        const response = await client.publishJSON({
          url: destinationUrl,
          headers,
          body: payload,
          delay: '2s',
          retries: 3,
        });

        console.log(`[Queue QStash] Tarea ${type} encolada exitosamente en QStash. MessageId: ${response.messageId}`);
        await logSystemEvent('INFO', 'queue_qstash_enqueued', `Tarea de Instagram (${type}) encolada en QStash`, {
          messageId: response.messageId,
          type,
          destinationUrl
        });

        return { success: true, driver: 'qstash', messageId: response.messageId };
      } catch (error: any) {
        console.error('[Queue QStash] Error publicando en QStash, recurriendo a DB fallback:', error.message);
        await logSystemEvent('WARN', 'queue_qstash_fallback', `Fallo en QStash (${error.message}). Usando fallback DB.`, { error: error.message });
      }
    }
  }

  // 2. DRIVER: DATABASE QUEUE (Fallback o autónomo sin dependencias externas)
  try {
    const job = await prisma.jobExecution.create({
      data: {
        jobName: `instagram_${type}_reply`,
        entityType: type,
        inputJson: data,
        status: 'STARTED',
      }
    });

    console.log(`[Queue DB] Tarea ${type} registrada en base de datos. JobId: ${job.id}`);

    // Procesamos de forma asíncrona con espaciado humano (1.5 segundos)
    setTimeout(async () => {
      try {
        if (type === 'comment') {
          await processInstagramComment(data);
        } else if (type === 'dm') {
          await processInstagramDirectMessage(data);
        }

        await prisma.jobExecution.update({
          where: { id: job.id },
          data: {
            status: 'SUCCEEDED',
            finishedAt: new Date()
          }
        });
      } catch (err: any) {
        console.error(`[Queue DB] Error ejecutando job ${job.id}:`, err.message);
        await prisma.jobExecution.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
            finishedAt: new Date()
          }
        });
      }
    }, 1500);

    return { success: true, driver: 'db', jobId: job.id };
  } catch (dbError: any) {
    console.error('[Queue DB] Error al crear JobExecution en base de datos:', dbError.message);
    // Último recurso: procesar directo
    if (type === 'comment') {
      await processInstagramComment(data);
    } else {
      await processInstagramDirectMessage(data);
    }
    return { success: true, driver: 'direct' };
  }
}
