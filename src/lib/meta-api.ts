type MetaErrorBody = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  is_transient?: boolean;
  error_user_title?: string;
  error_user_msg?: string;
};

type MetaResponseBody = {
  error?: MetaErrorBody;
  [key: string]: unknown;
};

export class MetaApiError extends Error {
  readonly operation: string;
  readonly status: number | null;
  readonly code?: number;
  readonly type?: string;
  readonly subcode?: number;
  readonly traceId?: string;
  readonly isTransient?: boolean;
  readonly userTitle?: string;
  readonly userMessage?: string;
  readonly responseBody?: unknown;

  constructor(options: {
    operation: string;
    message: string;
    status: number | null;
    error?: MetaErrorBody;
    responseBody?: unknown;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'MetaApiError';
    this.operation = options.operation;
    this.status = options.status;
    this.code = options.error?.code;
    this.type = options.error?.type;
    this.subcode = options.error?.error_subcode;
    this.traceId = options.error?.fbtrace_id;
    this.isTransient = options.error?.is_transient;
    this.userTitle = options.error?.error_user_title;
    this.userMessage = options.error?.error_user_msg;
    this.responseBody = options.responseBody;
  }

  get retryable() {
    return this.status === null || this.isTransient === true || this.status === 429 || this.status >= 500;
  }
}

function parseBody(rawBody: string): unknown {
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

export async function requestMeta<T extends MetaResponseBody>(
  operation: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  const configuredTimeout = Number(process.env.INSTAGRAM_PUBLISH_TIMEOUT_SECONDS || 25);
  const timeoutSeconds = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 25;
  const requestInit = init.signal
    ? init
    : { ...init, signal: AbortSignal.timeout(timeoutSeconds * 1000) };

  try {
    response = await fetch(url, requestInit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de red desconocido';
    throw new MetaApiError({
      operation,
      status: null,
      message: `Meta no respondió durante ${operation}: ${message}`,
      cause: error,
    });
  }

  const rawBody = await response.text();
  const body = parseBody(rawBody) as MetaResponseBody | string | null;
  const metaError = typeof body === 'object' && body !== null ? body.error : undefined;

  if (!response.ok || metaError) {
    const reason = metaError?.message || response.statusText || 'Respuesta inválida de Meta';
    const identifiers = [
      metaError?.code !== undefined ? `code=${metaError.code}` : null,
      metaError?.error_subcode !== undefined ? `subcode=${metaError.error_subcode}` : null,
      metaError?.type ? `type=${metaError.type}` : null,
      metaError?.fbtrace_id ? `trace=${metaError.fbtrace_id}` : null,
    ].filter(Boolean).join(', ');

    throw new MetaApiError({
      operation,
      status: response.status,
      error: metaError,
      responseBody: body,
      message: `Meta falló durante ${operation} (HTTP ${response.status}): ${reason}${identifiers ? ` [${identifiers}]` : ''}`,
    });
  }

  return body as T;
}

export function getMetaErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof MetaApiError) {
    return {
      provider: 'meta',
      operation: error.operation,
      message: error.message,
      httpStatus: error.status,
      code: error.code,
      type: error.type,
      subcode: error.subcode,
      traceId: error.traceId,
      isTransient: error.isTransient,
      retryable: error.retryable,
      userTitle: error.userTitle,
      userMessage: error.userMessage,
      responseBody: error.responseBody,
    };
  }

  return {
    provider: 'meta',
    message: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
}
