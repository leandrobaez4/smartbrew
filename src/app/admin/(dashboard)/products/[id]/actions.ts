'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

export async function checkAvailability(productId: string, externalId: string) {
  try {
    // Primero intentamos la API oficial
    const apiUrl = `https://api.mercadolibre.com/items/${externalId}`;
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADO_LIBRE_ACCESS_TOKEN || ''}`
      },
      signal: AbortSignal.timeout(10000),
    });

    // Si la API responde (sin bloqueo de PolicyAgent), usamos esa info
    if (apiResponse.status === 404) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'ARCHIVED' }
      });
      revalidatePath(`/admin/products/${productId}`);
      return { success: false, message: '❌ La publicación ya no existe (404). Estado cambiado a ARCHIVADO.' };
    }

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      
      if (data.status === 'paused' || data.status === 'closed' || data.status === 'inactive') {
        await prisma.product.update({
          where: { id: productId },
          data: { status: 'PAUSED' }
        });
        revalidatePath(`/admin/products/${productId}`);
        return { success: true, message: `⏸️ La publicación está "${data.status}". Estado cambiado a PAUSADO.` };
      }

      if (data.status === 'active') {
        // Actualizar precio si cambió
        if (data.price) {
          await prisma.product.update({
            where: { id: productId },
            data: { price: data.price }
          });
          revalidatePath(`/admin/products/${productId}`);
        }
        return { success: true, message: `✅ ¡Publicación ACTIVA! Precio actual: $${data.price}` };
      }

      return { success: true, message: `ℹ️ Estado en ML: "${data.status}"` };
    }

    // Si la API nos bloquea (403), informamos claramente
    if (apiResponse.status === 403) {
      return { 
        success: false, 
        message: '🔒 La API de Mercado Libre bloqueó la consulta (403 PolicyAgent). Necesitás certificar tu app en developers.mercadolibre.com.ar para desbloquear este endpoint.' 
      };
    }

    return { success: false, message: `⚠️ Error de la API: ${apiResponse.status} ${apiResponse.statusText}` };
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { success: false, message: '⏳ La API tardó demasiado en responder. Intentá de nuevo en unos segundos.' };
    }
    return { success: false, message: `❌ Error interno: ${error.message}` };
  }
}
