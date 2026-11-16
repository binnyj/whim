import type { ErrorResponse } from '@whim/shared';
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';

import { AppError, NotFoundError, RateLimitedError } from '../errors.js';

const INTERNAL_MESSAGE = 'Something went wrong. Please try again.';

interface ErrorReply {
  status: number;
  body: ErrorResponse;
  headers: Record<string, string>;
}

/** Client errors thrown by Express itself (e.g. malformed JSON) carry `status` and `expose`. */
function isExposedClientError(
  error: unknown,
): error is { status: number; message: string; type?: string } {
  if (typeof error !== 'object' || error === null) return false;
  const { status, expose } = error as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

/** Maps any thrown value to the status, JSON envelope and headers the client receives. */
export function toErrorReply(error: unknown): ErrorReply {
  if (error instanceof AppError) {
    const headers: Record<string, string> = {};
    if (error instanceof RateLimitedError && error.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      headers,
    };
  }

  if (isExposedClientError(error)) {
    const message =
      error.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : error.message;
    return { status: error.status, body: { error: { code: 'BAD_REQUEST', message } }, headers: {} };
  }

  // Anything else is a bug: never leak its message or stack to the client.
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE } },
    headers: {},
  };
}

/** Catch-all for requests that matched no route. Mount after every router. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};

/** Final error middleware: logs server-side failures and replies with the shared error envelope. */
export function errorHandler({
  logError,
}: {
  logError: (error: unknown, req: Request) => void;
}): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const { status, body, headers } = toErrorReply(error);
    if (status >= 500) logError(error, req);

    res.status(status).set(headers).json(body);
  };
}
