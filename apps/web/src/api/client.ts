import { errorResponseSchema } from '@whim/shared';
import type { z } from 'zod';

import { ApiError } from './api-error';

export interface ApiRequest<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Absolute path on the API, e.g. `/api/discover`. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  /** Sent as JSON. */
  body?: unknown;
  /** The response body must match this, or the call fails with `INVALID_RESPONSE`. */
  schema: S;
  /** Lets TanStack Query cancel requests a screen no longer needs. */
  signal?: AbortSignal;
}

export interface ApiClient {
  request<S extends z.ZodType>(req: ApiRequest<S>): Promise<z.output<S>>;
}

interface ApiClientOptions {
  /** Prefix for every path; empty means same origin. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  if (text === '') return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function createApiClient({
  baseUrl = '',
  fetch: fetchImpl = (...args) => globalThis.fetch(...args),
}: ApiClientOptions = {}): ApiClient {
  return {
    async request({ method = 'GET', path, query, body, schema, signal }) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined) params.set(key, String(value));
      }
      const search = params.size > 0 ? `?${params.toString()}` : '';

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${path}${search}`, {
          method,
          headers: {
            accept: 'application/json',
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
        });
      } catch (error) {
        // Cancellation isn't a failure; let the caller (TanStack Query) see the abort as-is.
        if (signal?.aborted) throw error;
        throw new ApiError({
          code: 'NETWORK_ERROR',
          message: "Can't reach Whim. Check your connection and try again.",
          cause: error,
        });
      }

      const { status } = response;
      const requestId = response.headers.get('x-request-id') ?? undefined;
      const json = parseJson(await response.text());

      if (!response.ok) {
        const envelope = json.ok ? errorResponseSchema.safeParse(json.value) : undefined;
        if (envelope?.success) {
          const { code, message, details } = envelope.data.error;
          throw new ApiError({ code, message, status, details, requestId });
        }
        throw new ApiError({
          code: status >= 500 ? 'UNAVAILABLE' : 'INVALID_RESPONSE',
          message:
            status >= 500
              ? 'Whim is temporarily unavailable. Please try again shortly.'
              : 'Unexpected response from the server.',
          status,
          requestId,
        });
      }

      const parsed = json.ok ? schema.safeParse(json.value) : undefined;
      if (!parsed?.success) {
        throw new ApiError({
          code: 'INVALID_RESPONSE',
          message: 'Unexpected response from the server.',
          status,
          requestId,
          // The Zod issues say exactly which field broke the contract.
          details: parsed?.error.issues,
          cause: parsed?.error,
        });
      }
      return parsed.data;
    },
  };
}

/** The app's API client, pointed at `VITE_API_BASE_URL` (same origin by default). */
export const apiClient = createApiClient({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? '' });
