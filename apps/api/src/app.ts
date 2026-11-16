import express, { type Express } from 'express';

import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.js';

export interface AppDeps {
  /** App version reported by `/health`. */
  version: string;
  /** Seconds the process has been running; injectable so tests are deterministic. */
  getUptime?: () => number;
  /** Where unexpected (5xx) errors are reported. Replaced by the structured logger later. */
  logError?: (error: unknown) => void;
}

/** Builds the Express app without binding a port, so tests can call it directly. */
export function createApp({
  version,
  getUptime = () => process.uptime(),
  logError = (error) => {
    console.error(error);
  },
}: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter({ version, getUptime }));

  app.use(notFoundHandler);
  app.use(errorHandler({ logError }));

  return app;
}
