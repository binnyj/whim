import type { ErrorCode } from '@whim/shared';

interface AppErrorOptions {
  /** Extra structured info for the client, e.g. field-level validation problems. */
  details?: unknown;
  /** The underlying error, kept for logs only. */
  cause?: unknown;
}

/**
 * Base class for errors the API expects and knows how to report.
 * The message is always safe to show to the client; internal context goes in `cause`.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;
  readonly details: unknown;

  constructor(message: string, { details, cause }: AppErrorOptions = {}) {
    super(message, { cause });
    this.name = new.target.name;
    this.details = details;
  }
}

/** The request is well-formed but its contents are invalid (400). */
export class ValidationError extends AppError {
  override readonly status = 400;
  override readonly code = 'VALIDATION_ERROR';
}

/** The requested resource or route doesn't exist (404). */
export class NotFoundError extends AppError {
  override readonly status = 404;
  override readonly code = 'NOT_FOUND';
}

/** The client, or we on its behalf, hit a rate limit (429). */
export class RateLimitedError extends AppError {
  override readonly status = 429;
  override readonly code = 'RATE_LIMITED';

  constructor(
    message = 'Too many requests. Please slow down and try again.',
    /** Sent as the `Retry-After` header when known. */
    readonly retryAfterSeconds?: number,
    options?: AppErrorOptions,
  ) {
    super(message, options);
  }
}

/** A provider we depend on (places, routing, AI) failed or misbehaved (502). */
export class UpstreamError extends AppError {
  override readonly status = 502;
  override readonly code = 'UPSTREAM_ERROR';

  constructor(
    /** Which provider failed, for logs. Not sent to the client. */
    readonly provider: string,
    options?: AppErrorOptions,
  ) {
    super('A service we depend on is unavailable. Please try again shortly.', options);
  }
}
