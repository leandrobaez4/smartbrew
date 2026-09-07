import { PrismaClient } from '@prisma/client';
import { logSystemEvent } from '@/lib/logger';

const prisma = new PrismaClient();

const baseUrl = process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
const token = process.env.INSTAGRAM_ACCESS_TOKEN;

/**
 * Envía una respuesta privada (Private Reply) por DM a un comentario en Instagram
 */
export async function sendInstagramPrivateReply(commentId: string, text: string) {
  if (!token) {
    throw new Error('Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno');
  }

  const url = `${baseUrl}/${version}/me/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: {
        comment_id: commentId
      },
      message: {
        text: text
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Error enviando Private Reply a comentario ${commentId}: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Envía un mensaje directo (DM) a un usuario por su ID de Instagram
 */
export async function sendInstagramDirectMessage(recipientId: string, text: string) {
  if (!token) {
    throw new Error('Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno');
  }

  const url = `${baseUrl}/${version}/me/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: {
        id: recipientId
      },
      message: {
        text: text
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Error enviando DM a ${recipientId}: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Responde públicamente a un comentario de Instagram (ej: "¡Te envié el link por privado! 📩")
 */
export async function sendInstagramPublicCommentReply(commentId: string, text: string) {
  if (!token) return null;

  try {
    const url = `${baseUrl}/${version}/${commentId}/replies`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text
      })
    });

    return await response.json();
  } catch (error) {
    console.error('No se pudo responder públicamente al comentario:', error);
    return null;
  }
}

/**
 * Procesa un comentario recibido en un posteo de Instagram
 */
export async function processInstagramComment(change: any) {
  const comment = change.value;
  if (!comment || !comment.id) return;

  const commentId = comment.id;
  const commentText = (comment.text || '').toLowerCase().trim();
  const mediaId = comment.media?.id;
  const fromUsername = comment.from?.username || 'amigo';
  const fromId = comment.from?.id;

  // Evitar responder a comentarios de nuestra propia cuenta
  if (fromId === process.env.INSTAGRAM_ACCOUNT_ID) {
    return;
  }

  console.log(`[IG Webhook] Comentario recibido de @${fromUsername}: "${commentText}" en media ${mediaId}`);

  // Palabras clave que indican interés en el link/producto
  const triggerKeywords = ['quiero', 'link', 'precio', 'info', 'alias', 'comprar', 'donde', 'dónde', 'pasa', 'me interesa', 'oferta'];
  const hasTriggerWord = triggerKeywords.some(kw => commentText.includes(kw));

  // Si no tiene palabras clave pero es un comentario corto (ej: "yo", "yo quiero", emojis), respondemos igual
  const isShortInterest = commentText.length <= 15 && (commentText.includes('yo') || commentText.includes('info') || commentText.includes('link'));

  if (!hasTriggerWord && !isShortInterest && commentText !== '') {
    console.log(`[IG Webhook] Comentario no coincide con palabras clave de activación.`);
    return;
  }

  // Buscamos la publicación en nuestra base de datos para saber qué producto es
  let product = null;

  if (mediaId) {
    const publication = await prisma.publication.findFirst({
      where: {
        externalMediaId: mediaId,
        platform: 'INSTAGRAM'
      },
      include: {
        draft: {
          include: {
            product: true
          }
        }
      }
    });

    if (publication && publication.draft?.product) {
      product = publication.draft.product;
    }
  }

  // Armamos el mensaje
  let messageText = '';
  const catalogUrl = `${process.env.APP_URL || 'https://smartbrew-baez3.vercel.app'}/productos`;

  if (product && product.affiliateUrl) {
    messageText = `¡Hola @${fromUsername}! 👋\n\nAcá tenés el enlace oficial con descuento para comprar "${product.title}":\n\n👉 ${product.affiliateUrl}\n\n¡Cualquier duda avisanos!`;
  } else {
    // Si no encontramos el producto específico del posteo, le enviamos el catálogo completo
    messageText = `¡Hola @${fromUsername}! 👋\n\nPodés ver todos nuestros productos recomendados y enlaces de ofertas acá:\n\n👉 ${catalogUrl}\n\n¡Que lo disfrutes!`;
  }

  try {
    // 1. Enviar el DM privado con el link de afiliado
    await sendInstagramPrivateReply(commentId, messageText);
    await logSystemEvent('INFO', 'instagram_auto_dm', `Enviado link a @${fromUsername} por comentario "${comment.text}"`, {
      commentId,
      username: fromUsername,
      mediaId,
      productId: product?.id,
      affiliateUrl: product?.affiliateUrl || catalogUrl
    });

    // 2. Responder públicamente al comentario para generar más tracción
    await sendInstagramPublicCommentReply(commentId, `¡Hola @${fromUsername}! Te enviamos el enlace por mensaje privado 📩`);
  } catch (error: any) {
    console.error(`[IG Webhook] Error al responder comentario:`, error.message);
    await logSystemEvent('ERROR', 'instagram_auto_dm', `Fallo al enviar DM a @${fromUsername}: ${error.message}`, {
      commentId,
      error: error.message
    });
  }
}

/**
 * Procesa un mensaje directo (DM) enviado a @smartbrew
 */
export async function processInstagramDirectMessage(messagingItem: any) {
  const senderId = messagingItem.sender?.id;
  const recipientId = messagingItem.recipient?.id;
  const message = messagingItem.message;

  // Ignorar si es un mensaje que enviamos nosotros mismos o un echo
  if (!message || message.is_echo || senderId === process.env.INSTAGRAM_ACCOUNT_ID) {
    return;
  }

  const messageText = (message.text || '').toLowerCase().trim();
  console.log(`[IG Webhook] DM recibido de ${senderId}: "${messageText}"`);

  const catalogUrl = `${process.env.APP_URL || 'https://smartbrew-baez3.vercel.app'}/productos`;

  // Intentamos buscar si mencionó alguna palabra clave de un producto activo
  let matchedProduct = null;
  if (messageText.length > 3) {
    const activeProducts = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        affiliateUrl: { not: null }
      },
      take: 20
    });

    for (const p of activeProducts) {
      const words = p.title.toLowerCase().split(' ').filter(w => w.length > 4);
      const matches = words.some(w => messageText.includes(w));
      if (matches) {
        matchedProduct = p;
        break;
      }
    }
  }

  let replyText = '';
  if (matchedProduct && matchedProduct.affiliateUrl) {
    replyText = `¡Hola! 👋 Gracias por escribirnos.\n\nAcá tenés el enlace con descuento para "${matchedProduct.title}":\n👉 ${matchedProduct.affiliateUrl}\n\n¡Cualquier consulta estamos a disposición!`;
  } else {
    replyText = `¡Hola! 👋 Gracias por contactarte con SmartBrew.\n\nEncontrá todos los productos, gadgets y ofertas que publicamos acá con sus enlaces oficiales:\n👉 ${catalogUrl}\n\n¡Que tengas un excelente día!`;
  }

  try {
    await sendInstagramDirectMessage(senderId, replyText);
    await logSystemEvent('INFO', 'instagram_dm_reply', `DM respondido a usuario ${senderId}`, {
      senderId,
      matchedProductId: matchedProduct?.id
    });
  } catch (error: any) {
    console.error(`[IG Webhook] Error al responder DM:`, error.message);
    await logSystemEvent('ERROR', 'instagram_dm_reply', `Error respondiendo DM a ${senderId}: ${error.message}`, {
      senderId,
      error: error.message
    });
  }
}
