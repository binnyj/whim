import { type DestinationStream, type Level, type Logger, pino } from 'pino';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

/**
 * Log paths whose values are replaced with `[Redacted]`. Covers credentials in request/response
 * headers and common secret-looking keys up to two levels deep in logged objects.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  ...['apiKey', 'password', 'secret', 'token', 'accessToken', 'refreshToken'].flatMap((key) => [
    key,
    `*.${key}`,
    `*.*.${key}`,
  ]),
];

export interface LoggerOptions {
  level: Level | 'silent';
  /** Where log lines go; stdout by default. Tests pass an in-memory stream. */
  destination?: DestinationStream;
}

/** Creates the API's structured JSON logger. */
export function createLogger({ level, destination }: LoggerOptions): Logger {
  return pino(
    {
      level,
      base: { service: 'api' },
      redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    },
    destination,
  );
}
