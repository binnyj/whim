import express, { type Express } from 'express';
import type { Logger } from 'pino';

import { createLogger } from './logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  /** App version reported by `/health`. */
  version: string;
  /** Seconds the process has been running; injectable so tests are deterministic. */
  getUptime?: () => number;
  /** Structured logger; silent by default so tests stay quiet. */
  logger?: Logger;
}

/** Builds the Express app without binding a port, so tests can call it directly. */
export function createApp({
  version,
  getUptime = () => process.uptime(),
  logger = createLogger({ level: 'silent' }),
}: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger(logger));
  app.use(express.json());

  app.use('/health', healthRouter({ version, getUptime }));

  app.use(notFoundHandler);
  app.use(
    errorHandler({
      logError: (error, req) => {
        req.log.error({ err: error }, 'Request failed');
      },
    }),
  );

  return app;
}
