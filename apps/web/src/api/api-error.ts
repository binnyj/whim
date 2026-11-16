import type { ErrorCode } from '@whim/shared';

/**
 * Codes the web app can see. The API's own codes, plus three the client produces itself:
 * - `NETWORK_ERROR`: the request never got a response (offline, DNS, CORS, server down).
 * - `UNAVAILABLE`: a 5xx that isn't from our API (e.g. a proxy or gateway error page).
 * - `INVALID_RESPONSE`: the API answered, but not in the shape the shared schemas expect.
 */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

interface ApiErrorInit {
  code: ApiErrorCode;
  message: string;
  /** HTTP status, when there was a response. */
  status?: number;
  details?: unknown;
  /** The API's `x-request-id`, for matching a user report to server logs. */
  requestId?: string;
  cause?: unknown;
}

/** Every failed API call throws this. UI code branches on `code`, never on `message`. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;
  readonly details: unknown;
  readonly requestId: string | undefined;

  constructor({ code, message, status, details, requestId, cause }: ApiErrorInit) {
    super(message, { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

/** Failures worth retrying: the request may succeed if tried again shortly. */
export function isTransient(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ['NETWORK_ERROR', 'UNAVAILABLE', 'UPSTREAM_ERROR', 'INTERNAL_ERROR'].includes(error.code)
  );
}
