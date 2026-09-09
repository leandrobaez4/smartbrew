import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMetaErrorDetails, MetaApiError, requestMeta } from '../lib/meta-api';

describe('Meta API diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts Meta error codes and trace information', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: 'Invalid OAuth access token',
        type: 'OAuthException',
        code: 190,
        error_subcode: 463,
        fbtrace_id: 'trace-123',
      },
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })));

    const error = await requestMeta('enviar DM', 'https://graph.facebook.com/test', {})
      .catch(caught => caught);

    expect(error).toBeInstanceOf(MetaApiError);
    expect(getMetaErrorDetails(error)).toMatchObject({
      operation: 'enviar DM',
      httpStatus: 400,
      code: 190,
      subcode: 463,
      type: 'OAuthException',
      traceId: 'trace-123',
      retryable: false,
    });
  });

  it('marks transient Meta failures as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Service temporarily unavailable', code: 2, is_transient: true },
    }), { status: 500 })));

    const error = await requestMeta('publicar contenido', 'https://graph.facebook.com/test', {})
      .catch(caught => caught);

    expect(getMetaErrorDetails(error)).toMatchObject({ retryable: true, httpStatus: 500, code: 2 });
  });

  it('wraps network failures without exposing request credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket timeout')));

    const error = await requestMeta('enviar DM', 'https://graph.facebook.com/test', {})
      .catch(caught => caught);

    expect(getMetaErrorDetails(error)).toMatchObject({
      provider: 'meta',
      operation: 'enviar DM',
      httpStatus: null,
      retryable: true,
    });
  });
});
