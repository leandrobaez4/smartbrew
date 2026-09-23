import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const facebookComment = z.object({
  pageId: z.string().regex(/^\d+$/),
  postId: z.string().regex(/^\d+_\d+$/),
  commentId: z.string().regex(/^\d+(?:_\d+)?$/),
});
export type FacebookComment = z.infer<typeof facebookComment>;
export const isFacebookInfo = (text: unknown) => typeof text === 'string' && text.trim().toLowerCase() === 'info';

export function verifyFacebookSignature(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

const envelope = z.object({ object: z.string(), entry: z.array(z.object({
  id: z.string(), changes: z.array(z.object({ field: z.string(), value: z.unknown() })).optional(),
})).optional() });
const valueSchema = z.object({ item: z.string(), verb: z.string(), message: z.string().optional(),
  post_id: z.string(), comment_id: z.string(), from: z.object({ id: z.string() }).optional(),
});
export function facebookInfoComments(body: unknown, pageId: string): FacebookComment[] {
  const parsed = envelope.safeParse(body);
  if (!parsed.success || parsed.data.object !== 'page') return [];
  const comments: FacebookComment[] = [];
  for (const entry of parsed.data.entry || []) {
    if (entry.id !== pageId) continue;
    for (const change of entry.changes || []) {
      const result = valueSchema.safeParse(change.value);
      if (change.field !== 'feed' || !result.success) continue;
      const v = result.data;
      if (v.item !== 'comment' || v.verb !== 'add' || !isFacebookInfo(v.message) || v.from?.id === pageId) continue;
      const comment = facebookComment.safeParse({ pageId, postId: v.post_id, commentId: v.comment_id });
      if (comment.success && comment.data.postId.startsWith(`${pageId}_`)) comments.push(comment.data);
    }
  }
  return comments;
}

// Explicit routing only: never guess from a caption or send a generic catalogue.
export function facebookProductId(postId: string) {
  const mapping = z.record(z.string().regex(/^\d+_\d+$/), z.string().regex(/^[\w-]{1,128}$/))
    .parse(JSON.parse(process.env.FACEBOOK_POST_PRODUCT_MAP || '{}'));
  return Object.hasOwn(mapping, postId) ? mapping[postId] : undefined;
}
