import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), meta: vi.fn(), log: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { publication = { findFirst: m.find }; } }));
vi.mock('@/lib/logger', () => ({ logSystemEvent: m.log }));
vi.mock('@/lib/meta-api', () => ({ requestMeta: m.meta, getMetaErrorDetails: () => ({ message: 'error' }) }));
import { processInstagramComment } from './instagram-bot';
beforeEach(() => vi.resetAllMocks());
it.each(['quiero', 'precio', 'link', 'yo', 'más info', 'Info!', '', '   '])('ignores non-exact Info comment %s', async text => {
  await processInstagramComment({ value: { id: 'comment', text, media: { id: 'media' }, from: { id: 'visitor' } } });
  expect(m.find).not.toHaveBeenCalled();
  expect(m.meta).not.toHaveBeenCalled();
});
it.each(['Info', 'INFO', ' info '])('accepts normalized Info comment %s', async text => {
  // The token is intentionally absent: matching must reach product lookup,
  // while this isolated test must never send a real message.
  m.find.mockRejectedValue(new Error('lookup reached'));
  await expect(processInstagramComment({ value: { id: 'comment', text, media: { id: 'media' }, from: { id: 'visitor' } } })).rejects.toThrow('lookup reached');
  expect(m.find).toHaveBeenCalledTimes(1);
});
