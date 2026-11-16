import type { Level } from 'pino';

import { createLogger } from '../logger.js';

export type LogLine = Record<string, unknown> & { level: number; msg?: string };

/** A real logger whose JSON lines are captured in memory for assertions. */
export function memoryLogger(level: Level = 'info') {
  const lines: LogLine[] = [];
  const logger = createLogger({
    level,
    destination: {
      write: (line: string) => {
        lines.push(JSON.parse(line) as LogLine);
      },
    },
  });
  return { logger, lines };
}
