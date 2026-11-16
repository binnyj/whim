import pkg from '../package.json' with { type: 'json' };
import { createApp } from './app.js';

// Replaced by the typed config loader in the next step.
const port = Number(process.env.PORT ?? 3000);

const app = createApp({ version: pkg.version });

const server = app.listen(port, () => {
  console.log(`@whim/api listening on http://localhost:${String(port)}`);
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
