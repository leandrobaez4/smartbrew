import { PrismaClient } from '@prisma/client';
import { logSystemEvent } from '@/lib/logger';
import { getMetaErrorDetails, requestMeta } from '@/lib/meta-api';

const prisma = new PrismaClient();

const baseUrl = process.env.META_GRAPH_API_BASE_URL || 'https://graph.facebook.com';
const version = process.env.META_GRAPH_API_VERSION || 'v21.0';
const token = process.env.INSTAGRAM_ACCESS_TOKEN;

type InstagramCommentChange = {
  value?: {
    id?: string;
    text?: string;
    media?: { id?: string };
    from?: { id?: string; username?: string };
  };
};

type InstagramMessagingItem = {
  sender?: { id?: string };
  message?: { text?: string; is_echo?: boolean };
};

export function instagramCatalogUrl() {
  return (process.env.INSTAGRAM_CATALOG_URL || 'https://www.smartbrew.tech/productos').replace(/\/+$/, '');
}

export function instagramProductReply(fromUsername: string, product: { title: string; affiliateUrl: string }) {
  return `¡Hola @${fromUsername}! 👋\n\nAcá tenés el enlace de afiliado para comprar "${product.title}":\n\n👉 ${product.affiliateUrl}\n\nTambién podés ver todos nuestros productos recomendados y ofertas en:\n\n👉 ${instagramCatalogUrl()}\n\n¡Cualquier duda avisanos!`;
}

function captionUrls(caption: unknown) {
  if (typeof caption !== 'string') return [];
  return (caption.match(/https?:\/\/[^\s]+/g) || []).map(url => url.replace(/[),.;!?]+$/, ''));
}

async function findProductForMedia(mediaId: string) {
  const publication = await prisma.publication.findFirst({
    where: { externalMediaId: mediaId, platform: 'INSTAGRAM' },
    include: { draft: { include: { product: true } } },
  });
  if (publication?.draft?.product) return publication.draft.product;

  // Las publicaciones conciliadas pueden recibir comentarios antes de que el mediaId
  // quede asociado localmente. En ese caso recuperamos el afiliado desde su caption.
  if (!token) return null;
  try {
    const media = await requestMeta<{ caption?: unknown }>(
      'obtener publicación de Instagram para resolver el producto',
      `${baseUrl}/${version}/${mediaId}?fields=caption`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    const urls = captionUrls(media?.caption);
    if (urls.length === 0) return null;
    return prisma.product.findFirst({ where: { affiliateUrl: { in: urls } } });
  } catch (error: unknown) {
    console.warn('[IG Webhook] No se pudo resolver el producto desde el caption:', getMetaErrorDetails(error));
    return null;
  }
}

/**
 * Envía una respuesta privada (Private Reply) por DM a un comentario en Instagram
 */
export async function sendInstagramPrivateReply(commentId: string, text: string) {
  if (!token) {
    throw new Error('Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno');
  }

  const accountId = process.env.INSTAGRAM_ACCOUNT_ID || 'me';
  const url = `${baseUrl}/${version}/${accountId}/messages`;
  return requestMeta<{ id?: string }>('enviar respuesta privada a comentario', url, {
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
}

/**
 * Envía un mensaje directo (DM) a un usuario por su ID de Instagram
 */
export async function sendInstagramDirectMessage(recipientId: string, text: string) {
  if (!token) {
    throw new Error('Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno');
  }

  const accountId = process.env.INSTAGRAM_ACCOUNT_ID || 'me';
  const url = `${baseUrl}/${version}/${accountId}/messages`;
  return requestMeta<{ message_id?: string }>('enviar mensaje directo', url, {
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
}

/**
 * Responde públicamente a un comentario de Instagram (ej: "¡Te envié el link por privado! 📩")
 */
export async function sendInstagramPublicCommentReply(commentId: string, text: string) {
  if (!token) {
    throw new Error('Falta INSTAGRAM_ACCESS_TOKEN en las variables de entorno');
  }

  const url = `${baseUrl}/${version}/${commentId}/replies`;
  return requestMeta<{ id?: string }>('responder públicamente un comentario', url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: text })
  });
}

/**
 * Procesa un comentario recibido en un posteo de Instagram
 */
export async function processInstagramComment(change: InstagramCommentChange) {
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

  // Misma regla que Facebook: únicamente Info, sin distinguir mayúsculas.
  if (commentText !== 'info') {
    console.log(`[IG Webhook] Comentario no coincide con palabras clave de activación.`);
    return;
  }

  // Buscamos la publicación en nuestra base de datos para saber qué producto es
  let product = null;

  if (mediaId) {
    product = await findProductForMedia(mediaId);
  }

  // Armamos el mensaje
  let messageText = '';
  const catalogUrl = instagramCatalogUrl();

  if (product && product.affiliateUrl) {
    messageText = instagramProductReply(fromUsername, { title: product.title, affiliateUrl: product.affiliateUrl });
  } else {
    // Si no encontramos el producto específico del posteo, le enviamos el catálogo completo
    messageText = `¡Hola @${fromUsername}! 👋\n\nPodés ver todos nuestros productos recomendados y enlaces de ofertas acá:\n\n👉 ${catalogUrl}\n\n¡Que lo disfrutes!`;
  }

  // El DM privado es el efecto principal. Si falla, propagamos el error para que QStash reintente.
  try {
    await sendInstagramPrivateReply(commentId, messageText);
    await logSystemEvent('INFO', 'instagram_auto_dm', `Enviado link a @${fromUsername} por comentario "${comment.text}"`, {
      commentId,
      username: fromUsername,
      mediaId,
      productId: product?.id,
      affiliateUrl: product?.affiliateUrl || catalogUrl
    });

  } catch (error: unknown) {
    const details = getMetaErrorDetails(error);
    console.error('[IG Webhook] Error al enviar respuesta privada:', details);
    await logSystemEvent('ERROR', 'instagram_auto_dm', `Fallo al enviar DM a @${fromUsername}: ${String(details.message)}`, {
      commentId,
      ...details,
    });
    throw error;
  }

  // La respuesta pública es secundaria. Se registra su fallo, pero no se reintenta todo el job
  // porque eso podría duplicar el DM privado que ya fue entregado.
  try {
    await sendInstagramPublicCommentReply(commentId, `¡Hola @${fromUsername}! Te enviamos el enlace por mensaje privado 📩`);
  } catch (error: unknown) {
    const details = getMetaErrorDetails(error);
    console.error('[IG Webhook] Error al responder públicamente:', details);
    await logSystemEvent('ERROR', 'instagram_public_reply', `Meta rechazó la respuesta pública a @${fromUsername}: ${String(details.message)}`, {
      commentId,
      ...details,
    });
  }
}

/**
 * Procesa un mensaje directo (DM) enviado a @smartbrew
 */
export async function processInstagramDirectMessage(messagingItem: InstagramMessagingItem) {
  const senderId = messagingItem.sender?.id;
  const message = messagingItem.message;

  // Ignorar si es un mensaje que enviamos nosotros mismos o un echo
  if (!message || !senderId || message.is_echo || senderId === process.env.INSTAGRAM_ACCOUNT_ID) {
    return;
  }

  const messageText = (message.text || '').toLowerCase().trim();
  console.log(`[IG Webhook] DM recibido de ${senderId}: "${messageText}"`);

  const catalogUrl = instagramCatalogUrl();

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
    replyText = `¡Hola! 👋 Gracias por escribirnos.\n\nAcá tenés el enlace de afiliado para "${matchedProduct.title}":\n👉 ${matchedProduct.affiliateUrl}\n\nMás productos y ofertas:\n👉 ${catalogUrl}\n\n¡Cualquier consulta estamos a disposición!`;
  } else {
    replyText = `¡Hola! 👋 Gracias por contactarte con SmartBrew.\n\nEncontrá todos los productos, gadgets y ofertas que publicamos acá con sus enlaces oficiales:\n👉 ${catalogUrl}\n\n¡Que tengas un excelente día!`;
  }

  try {
    await sendInstagramDirectMessage(senderId, replyText);
    await logSystemEvent('INFO', 'instagram_dm_reply', `DM respondido a usuario ${senderId}`, {
      senderId,
      matchedProductId: matchedProduct?.id
    });
  } catch (error: unknown) {
    const details = getMetaErrorDetails(error);
    console.error('[IG Webhook] Error al responder DM:', details);
    await logSystemEvent('ERROR', 'instagram_dm_reply', `Error respondiendo DM a ${senderId}: ${String(details.message)}`, {
      senderId,
      ...details,
    });
    throw error;
  }
}
