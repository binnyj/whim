import { randomUUID } from 'node:crypto';

import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Inbound IDs are reused only if short and plain, so clients can't inject junk into logs. */
const SAFE_REQUEST_ID = /^[\w.-]{1,128}$/;

/** Reuses a caller's `x-request-id` when it's safe, otherwise generates a fresh UUID. */
export function resolveRequestId(inbound: string | string[] | undefined): string {
  return typeof inbound === 'string' && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID();
}

/**
 * Assigns every request an ID (echoed in the `x-request-id` response header), gives it a child
 * logger at `req.log` that stamps `reqId` on every line, and logs one line per completed request
 * with status and duration. Health checks are not logged, to keep uptime pings out of the logs.
 */
export function requestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    quietReqLogger: true,
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => req.url?.split('?')[0] === '/health' },
  });
}
