import pkg from '../package.json' with { type: 'json' };
import { createApp } from './app.js';
import { type Config, ConfigError, loadConfig } from './config.js';
import { createLogger } from './logger.js';

// Load apps/api/.env if present; real environment variables still win.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  // The logger needs config, so config problems go straight to stderr.
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const logger = createLogger({ level: config.LOG_LEVEL });
const app = createApp({ version: pkg.version, logger });

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV, version: pkg.version },
    `API listening on http://localhost:${String(config.PORT)}`,
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
