type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue : undefined;

// Only structural metadata: never log payloads, usernames, text, tokens or IDs.
export function describeInstagramWebhook(body: unknown) {
  const root = record(body);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const fields: Record<string, number> = {};
  let messagingCount = 0;
  let malformedEntries = 0;
  for (const value of entries) {
    const entry = record(value);
    if (!entry) { malformedEntries++; continue; }
    if (Array.isArray(entry.messaging)) messagingCount += entry.messaging.length;
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const field = record(change)?.field;
        const key = typeof field === 'string' &&
          ['comments', 'live_comments', 'mentions', 'messages', 'messaging_postbacks', 'message_reactions', 'messaging_seen'].includes(field)
          ? field : 'other';
        fields[key] = (fields[key] || 0) + 1;
      }
    }
  }
  return {
    object: root?.object === 'instagram' ? 'instagram' : root?.object === 'page' ? 'page' : 'other',
    hasEntryArray: Array.isArray(root?.entry),
    entryCount: entries.length,
    malformedEntries,
    fields,
    messagingCount,
  };
}

export async function dispatchInstagramWebhook(
  body: unknown,
  enqueue: (type: 'comment' | 'dm', data: unknown) => Promise<unknown>,
) {
  const root = record(body);
  let enqueuedComments = 0;
  let enqueuedMessages = 0;
  let ignoredChanges = 0;
  if (root?.object !== 'instagram') {
    return { status: 'IGNORED', reason: 'unsupported_object', enqueuedComments, enqueuedMessages, ignoredChanges };
  }
  if (!Array.isArray(root.entry)) {
    return { status: 'IGNORED', reason: 'entry_not_array', enqueuedComments, enqueuedMessages, ignoredChanges };
  }
  for (const value of root.entry) {
    const entry = record(value);
    if (!entry) continue;
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (record(change)?.field === 'comments') {
          await enqueue('comment', change);
          enqueuedComments++;
        } else ignoredChanges++;
      }
    }
    if (Array.isArray(entry.messaging)) {
      for (const item of entry.messaging) {
        await enqueue('dm', item);
        enqueuedMessages++;
      }
    }
  }
  return {
    status: 'EVENT_RECEIVED',
    reason: enqueuedComments + enqueuedMessages > 0 ? 'enqueued' : 'no_supported_events',
    enqueuedComments, enqueuedMessages, ignoredChanges,
  };
}
