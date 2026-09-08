'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { enqueueInstagramJob } from '@/lib/queue/instagram-queue';

const prisma = new PrismaClient();

/**
 * Simula la llegada de un comentario de un usuario en un posteo de Instagram
 */
export async function simulateInstagramCommentAction() {
  try {
    // Buscamos una publicación real en la base de datos para simular sobre ella
    const publication = await prisma.publication.findFirst({
      where: { platform: 'INSTAGRAM' },
      include: { draft: { include: { product: true } } }
    });

    const mediaId = publication?.externalMediaId || '17971150559948307';
    const productTitle = publication?.draft?.product?.title || 'Producto de Prueba';

    const testCommentEvent = {
      id: `sim_comment_${Date.now()}`,
      text: '¡Hola! Quiero el link por favor 🔥',
      from: {
        id: 'sim_user_999',
        username: 'cliente_interesado'
      },
      media: {
        id: mediaId
      }
    };

    const result = await enqueueInstagramJob('comment', testCommentEvent);
    revalidatePath('/admin/logs');

    return { 
      success: true, 
      message: `Comentario simulado en "${productTitle}" encolado con éxito via ${result.driver.toUpperCase()}.`,
      result 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * Simula la llegada de un mensaje directo (DM) enviado a @smartbrew
 */
export async function simulateInstagramDmAction() {
  try {
    const testDmEvent = {
      sender: { id: 'sim_user_888' },
      recipient: { id: process.env.INSTAGRAM_ACCOUNT_ID || '17841437788327754' },
      timestamp: Date.now(),
      message: {
        mid: `sim_mid_${Date.now()}`,
        text: '¡Hola! ¿Tienen ofertas o recomendaciones de cafeteras y gadgets?'
      }
    };

    const result = await enqueueInstagramJob('dm', testDmEvent);
    revalidatePath('/admin/logs');

    return { 
      success: true, 
      message: `DM simulado ("¿Tienen ofertas...?") encolado con éxito via ${result.driver.toUpperCase()}.`,
      result 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
