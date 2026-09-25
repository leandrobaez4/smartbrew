import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), meta: vi.fn(), log: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { publication = { findFirst: m.find }; } }));
vi.mock('@/lib/logger', () => ({ logSystemEvent: m.log }));
vi.mock('@/lib/meta-api', () => ({ requestMeta: m.meta, getMetaErrorDetails: () => ({ message: 'error' }) }));
import { instagramCatalogUrl, instagramProductReply, processInstagramComment } from './instagram-bot';
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

it('uses the production catalog instead of APP_URL and keeps the affiliate link', () => {
  vi.stubEnv('APP_URL', 'https://smartbrew-rouge.vercel.app');
  expect(instagramCatalogUrl()).toBe('https://www.smartbrew.tech/productos');
  const message = instagramProductReply('leandro.baez1', {
    id: 'product-123', title: 'Cafetera Smart', affiliateUrl: 'https://meli.la/oferta',
  });
  expect(message).toContain('https://meli.la/oferta');
  expect(message).toContain('https://www.smartbrew.tech/productos/product-123');
  expect(message).not.toContain('https://www.smartbrew.tech/productos\n');
  expect(message).not.toContain('smartbrew-rouge.vercel.app');
});

it('allows an explicit production catalog override without a trailing slash', () => {
  vi.stubEnv('INSTAGRAM_CATALOG_URL', 'https://smartbrew.tech/productos/');
  expect(instagramCatalogUrl()).toBe('https://smartbrew.tech/productos');
});
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
