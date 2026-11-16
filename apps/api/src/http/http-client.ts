import type { Logger } from 'pino';
import type { z } from 'zod';

import { RateLimitedError, UpstreamError } from '../errors.js';

export interface HttpClientOptions {
  /** Provider name used in logs and errors, e.g. `places`. */
  provider: string;
  baseUrl: string;
  logger: Logger;
  /** Per-attempt timeout. Default 5000 ms. */
  timeoutMs?: number;
  /** Extra attempts after the first on network errors, timeouts and 5xx. Default 2. */
  retries?: number;
  /** First backoff delay; doubles each retry, with jitter. Default 200 ms. */
  backoffMs?: number;
  /** Upper bound for any single backoff delay. Default 2000 ms. */
  maxBackoffMs?: number;
  /** Headers sent with every request (e.g. auth). Never logged. */
  headers?: Record<string, string>;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface HttpRequest<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Sent as JSON. */
  body?: unknown;
  /** Every response body is validated; anything that doesn't match is treated as an upstream failure. */
  schema: S;
  timeoutMs?: number;
}

export interface HttpClient {
  request<S extends z.ZodType>(req: HttpRequest<S>): Promise<z.output<S>>;
}

/** Outcome of one attempt: a value, or an error plus whether trying again could help. */
type Attempt<T> = { ok: true; value: T } | { ok: false; error: Error; retryable: boolean };

const realSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Parses a `Retry-After` header given in seconds. HTTP-date values are ignored. */
function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null || !/^\d+$/.test(header.trim())) return undefined;
  return Number(header);
}

/**
 * The single place outbound HTTP happens. Every provider client (places, routing, AI) builds on it.
 *
 * - Each attempt has a timeout.
 * - Network errors, timeouts and 5xx are retried with exponential backoff and jitter.
 * - 4xx is never retried: a 429 becomes `RateLimitedError`, any other 4xx an `UpstreamError`.
 * - Responses must be JSON matching the request's schema, or the call fails with `UpstreamError`.
 * - Every attempt is logged with provider, method, URL (no query string), status and duration.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    provider,
    baseUrl,
    logger,
    timeoutMs: defaultTimeoutMs = 5000,
    retries = 2,
    backoffMs = 200,
    maxBackoffMs = 2000,
    headers: defaultHeaders = {},
    fetch: fetchImpl = globalThis.fetch,
    sleep = realSleep,
    random = Math.random,
  } = options;
  const log = logger.child({ provider });
  // Without a trailing slash, relative resolution would drop the last segment (e.g. `/v1`).
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  async function attempt<S extends z.ZodType>(
    req: HttpRequest<S>,
    url: URL,
    attemptNumber: number,
  ): Promise<Attempt<z.output<S>>> {
    const method = req.method ?? 'GET';
    // Only origin + path are logged: query strings can carry API keys.
    const logUrl = `${url.origin}${url.pathname}`;
    const timeoutMs = req.timeoutMs ?? defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    const started = performance.now();
    const context = { method, url: logUrl, attempt: attemptNumber };
    const fail = (error: Error, retryable: boolean, extra: object = {}): Attempt<never> => {
      log.warn(
        { ...context, ...extra, durationMs: Math.round(performance.now() - started), err: error },
        'Upstream call failed',
      );
      return { ok: false, error, retryable };
    };

    try {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            accept: 'application/json',
            ...(req.body === undefined ? {} : { 'content-type': 'application/json' }),
            ...defaultHeaders,
            ...req.headers,
          },
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
          signal: controller.signal,
        });
      } catch (error) {
        const reason = controller.signal.aborted
          ? new Error(`Timed out after ${String(timeoutMs)} ms`, { cause: error })
          : new Error('Network error', { cause: error });
        return fail(reason, true);
      }

      const { status } = response;
      const text = await response.text();

      if (status === 429) {
        return fail(
          new RateLimitedError(undefined, retryAfterSeconds(response.headers.get('retry-after')), {
            cause: new Error(`HTTP 429 from ${provider}`),
          }),
          false,
          { status },
        );
      }
      if (status >= 500) return fail(new Error(`HTTP ${String(status)}`), true, { status });
      if (status >= 400) {
        return fail(new Error(`HTTP ${String(status)}: ${text.slice(0, 500)}`), false, { status });
      }

      let json: unknown;
      try {
        json = text === '' ? undefined : JSON.parse(text);
      } catch (error) {
        return fail(new Error('Response is not valid JSON', { cause: error }), false, { status });
      }

      const parsed = req.schema.safeParse(json);
      if (!parsed.success) {
        return fail(
          new Error('Response does not match the expected schema', { cause: parsed.error }),
          false,
          { status },
        );
      }

      log.debug(
        { ...context, status, durationMs: Math.round(performance.now() - started) },
        'Upstream call succeeded',
      );
      return { ok: true, value: parsed.data };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async request(req) {
      // `./` keeps a path like `places:search` from being read as a URL scheme.
      const url = new URL(`./${req.path.replace(/^\/+/, '')}`, base);
      for (const [key, value] of Object.entries(req.query ?? {})) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }

      for (let attemptNumber = 1; ; attemptNumber++) {
        const result = await attempt(req, url, attemptNumber);
        if (result.ok) return result.value;

        const { error, retryable } = result;
        if (!retryable || attemptNumber > retries) {
          throw error instanceof RateLimitedError
            ? error
            : new UpstreamError(provider, { cause: error });
        }

        const ceiling = Math.min(maxBackoffMs, backoffMs * 2 ** (attemptNumber - 1));
        await sleep(Math.round(ceiling / 2 + (random() * ceiling) / 2));
      }
    },
  };
}
