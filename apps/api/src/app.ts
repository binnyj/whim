import express, { type Express } from 'express';

import { healthRouter } from './routes/health.js';

export interface AppDeps {
  /** App version reported by `/health`. */
  version: string;
  /** Seconds the process has been running; injectable so tests are deterministic. */
  getUptime?: () => number;
}

/** Builds the Express app without binding a port, so tests can call it directly. */
export function createApp({ version, getUptime = () => process.uptime() }: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/health', healthRouter({ version, getUptime }));

  return app;
}
