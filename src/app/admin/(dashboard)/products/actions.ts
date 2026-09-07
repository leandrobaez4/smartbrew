'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { logSystemEvent } from '@/lib/logger';

const prisma = new PrismaClient();

async function publishImageToInstagram(imageUrl: string, caption: string) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const baseUrl = process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
  // Fallback to v19.0 if not specified
  const version = process.env.META_GRAPH_API_VERSION || 'v19.0';
  
  if (!token || !accountId) {
    throw new Error('Faltan credenciales de Instagram en .env (INSTAGRAM_ACCESS_TOKEN o INSTAGRAM_ACCOUNT_ID)');
  }
  
  if (!imageUrl) {
    throw new Error('El producto no tiene una imagen válida para publicar');
  }

  // 1. Crear Contenedor de Media
  const createContainerUrl = `${baseUrl}/${version}/${accountId}/media`;
  const containerFormData = new URLSearchParams();
  containerFormData.append('image_url', imageUrl);
  containerFormData.append('caption', caption);
  containerFormData.append('access_token', token);

  const containerRes = await fetch(createContainerUrl, { method: 'POST', body: containerFormData });
  const containerData = await containerRes.json();
  
  if (!containerRes.ok) {
    throw new Error(`Error en IG API (Media): ${containerData.error?.message || JSON.stringify(containerData)}`);
  }
  
  const creationId = containerData.id;

  // 2. Publicar el Contenedor
  const publishUrl = `${baseUrl}/${version}/${accountId}/media_publish`;
  const publishFormData = new URLSearchParams();
  publishFormData.append('creation_id', creationId);
  publishFormData.append('access_token', token);

  const publishRes = await fetch(publishUrl, { method: 'POST', body: publishFormData });
  const publishData = await publishRes.json();
  
  if (!publishRes.ok) {
    throw new Error(`Error en IG API (Media Publish): ${publishData.error?.message || JSON.stringify(publishData)}`);
  }
  
  return publishData.id; // Este es el externalMediaId
}

export async function publishToInstagramAction(productIds: string[]) {
  if (productIds.length === 0) return { success: false, message: 'Ningún producto seleccionado' };

  try {
    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { drafts: true }
      });

      if (!product) {
        await logSystemEvent('WARN', 'instagram_publish', `Producto no encontrado: ${productId}`);
        continue;
      }

      // 🚨 VALIDACIÓN: Debe tener link de afiliado
      if (!product.affiliateUrl) {
        const errorMsg = `El producto "${product.title}" no tiene Link de Afiliado configurado.`;
        await logSystemEvent('WARN', 'instagram_publish', errorMsg);
        // Cortamos la ejecución con error
        throw new Error(errorMsg);
      }

      let draft = product.drafts[0];

      if (!draft) {
        draft = await prisma.contentDraft.create({
          data: {
            productId: product.id,
            status: 'APPROVED',
            caption: `¡Mirá este producto! ${product.title}\n\nConseguilo acá: ${product.affiliateUrl}\n\n#SmartBrew #Recomendado`,
            priceSnapshot: product.price,
            currencySnapshot: product.currencyId,
          }
        });
        await logSystemEvent('INFO', 'instagram_publish', `Draft automático creado para el producto: ${product.id}`);
      }

      // Verificamos si ya hay una publicación exitosa
      const existingPub = await prisma.publication.findFirst({
        where: { contentDraftId: draft.id, platform: 'INSTAGRAM' }
      });

      if (existingPub && existingPub.status === 'PUBLISHED') {
        continue; // Ya está publicado
      }

      try {
        // Asegurarnos de que el link de afiliado esté en el caption final
        let finalCaption = draft.caption || `Recomendación: ${product.title}`;
        if (!finalCaption.includes(product.affiliateUrl)) {
          finalCaption += `\n\nLink: ${product.affiliateUrl}`;
        }

        // Llamada REAL a la API de Instagram
        const externalMediaId = await publishImageToInstagram(
          product.primaryImageUrl || '',
          finalCaption
        );

        if (existingPub) {
          await prisma.publication.update({
            where: { id: existingPub.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), externalMediaId }
          });
        } else {
          await prisma.publication.create({
            data: {
              contentDraftId: draft.id,
              platform: 'INSTAGRAM',
              status: 'PUBLISHED',
              publishedAt: new Date(),
              externalMediaId
            }
          });
        }
        await logSystemEvent('INFO', 'instagram_publish', `¡Publicado con éxito en Instagram! Media ID: ${externalMediaId}`, { productId, externalMediaId });
      } catch (igError: any) {
        await logSystemEvent('ERROR', 'instagram_publish', `Error subiendo a Instagram: ${igError.message}`, { productId, error: igError.message });
        
        // Guardamos el registro como fallido
        if (!existingPub) {
          await prisma.publication.create({
            data: {
              contentDraftId: draft.id,
              platform: 'INSTAGRAM',
              status: 'FAILED',
              lastErrorMessage: igError.message
            }
          });
        } else {
          await prisma.publication.update({
            where: { id: existingPub.id },
            data: { status: 'FAILED', lastErrorMessage: igError.message }
          });
        }
        
        throw new Error(`Error en producto ${product.title}: ${igError.message}`);
      }
    }

    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function unpublishFromInstagramAction(productIds: string[]) {
  if (productIds.length === 0) return { success: false };

  try {
    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { drafts: true }
      });

      if (!product) continue;

      for (const draft of product.drafts) {
        await prisma.publication.deleteMany({
          where: {
            contentDraftId: draft.id,
            platform: 'INSTAGRAM'
          }
        });
        await logSystemEvent('INFO', 'instagram_unpublish', `Registro local de publicación eliminado`, { productId, draftId: draft.id });
      }
    }

    revalidatePath('/admin/products');
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function verifyInstagramPublicationAction(productId: string) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { drafts: { include: { publications: true } } }
    });

    if (!product) return { success: false, message: 'Producto no encontrado' };

    const draft = product.drafts[0];
    if (!draft) return { success: false, message: 'No hay borrador asociado' };

    const pub = draft.publications.find(p => p.platform === 'INSTAGRAM' && p.status === 'PUBLISHED');
    if (!pub || !pub.externalMediaId) {
      return { success: false, message: 'No figura como publicado localmente o falta el Media ID' };
    }

    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const baseUrl = process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
    const version = process.env.META_GRAPH_API_VERSION || 'v19.0';

    if (!token) return { success: false, message: 'Falta el token de Instagram en .env' };

    // Verificar en la API de Meta si el post existe
    const res = await fetch(`${baseUrl}/${version}/${pub.externalMediaId}?fields=id&access_token=${token}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      // Si la API dice que no existe (ej. borrado manual en IG)
      await prisma.publication.delete({ where: { id: pub.id } });
      await logSystemEvent('WARN', 'instagram_verify', `Publicación no encontrada en IG. Se eliminó localmente.`, { productId, mediaId: pub.externalMediaId, error: data.error });
      revalidatePath('/admin/products');
      revalidatePath(`/admin/products/${productId}`);
      return { success: true, status: 'DELETED', message: 'La publicación fue eliminada en Instagram. Ya actualizamos nuestra base de datos.' };
    }

    return { success: true, status: 'EXISTS', message: 'Verificado: La publicación sigue activa en Instagram.' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateProductStatusAction(productId: string, status: 'CANDIDATE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { status }
    });
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

