import pkg from '../package.json' with { type: 'json' };
import { createApp } from './app.js';
import { type Config, ConfigError, loadConfig } from './config.js';

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
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const app = createApp({ version: pkg.version });

const server = app.listen(config.PORT, () => {
  console.log(
    `@whim/api (${config.NODE_ENV}) listening on http://localhost:${String(config.PORT)}`,
  );
});

function shutdown(signal: string): void {
  console.log(`${signal} received, closing server`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
