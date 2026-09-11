import { describe, expect, it, vi } from 'vitest';
import { describeInstagramWebhook, dispatchInstagramWebhook } from './instagram-webhook';

describe('Instagram webhook diagnostics', () => {
  it('preserves the comment envelope and dispatches messaging', async () => {
    const comment = { field: 'comments', value: { id: '1', text: 'quiero' } };
    const message = { message: { text: 'hello' } };
    const enqueue = vi.fn().mockResolvedValue({ success: true });
    const result = await dispatchInstagramWebhook({ object: 'instagram', entry: [{ changes: [comment], messaging: [message] }] }, enqueue);
    expect(enqueue.mock.calls).toEqual([['comment', comment], ['dm', message]]);
    expect(result).toMatchObject({ reason: 'enqueued', enqueuedComments: 1, enqueuedMessages: 1 });
  });
  it.each([
    [null, 'unsupported_object'],
    [{ object: 'page', entry: [] }, 'unsupported_object'],
    [{ object: 'instagram' }, 'entry_not_array'],
    [{ object: 'instagram', entry: [] }, 'no_supported_events'],
    [{ object: 'instagram', entry: [null, { changes: [{ field: 'mentions' }] }] }, 'no_supported_events'],
  ])('explains ignored input %j', async (body, reason) => {
    const enqueue = vi.fn();
    expect((await dispatchInstagramWebhook(body, enqueue)).reason).toBe(reason);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('propagates enqueue failure so Meta can retry', async () => {
    await expect(dispatchInstagramWebhook({ object: 'instagram', entry: [{ changes: [{ field: 'comments' }] }] }, vi.fn().mockRejectedValue(new Error('queue failure')))).rejects.toThrow('queue failure');
  });
  it('logs only allowlisted structural metadata', () => {
    const body = { object: 'instagram', access_token: 'SECRET', entry: [null, { id: 'PRIVATE_ID', changes: [{ field: 'comments', value: { text: 'PRIVATE_TEXT' } }, { field: 'SECRET' }], messaging: [{ sender: { id: 'PRIVATE_USER' } }] }] };
    expect(describeInstagramWebhook(body)).toEqual({ object: 'instagram', hasEntryArray: true, entryCount: 2, malformedEntries: 1, fields: { comments: 1, other: 1 }, messagingCount: 1 });
    expect(JSON.stringify(describeInstagramWebhook(body))).not.toMatch(/SECRET|PRIVATE/);
  });
});
