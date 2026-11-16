import { describe, expect, it } from 'vitest';

import { memoryLogger } from './test-utils/memory-logger.js';

describe('createLogger', () => {
  it('writes structured JSON with level, message and service', () => {
    const { logger, lines } = memoryLogger();

    logger.info({ stops: 3 }, 'Itinerary generated');

    expect(lines).toEqual([
      expect.objectContaining({ level: 30, msg: 'Itinerary generated', service: 'api', stops: 3 }),
    ]);
  });

  it('respects the level', () => {
    const { logger, lines } = memoryLogger('warn');

    logger.info('hidden');
    logger.warn('shown');

    expect(lines.map((line) => line.msg)).toEqual(['shown']);
  });

  it('redacts secret-looking keys at the top level and nested', () => {
    const { logger, lines } = memoryLogger();

    logger.info({
      apiKey: 'sk-top',
      provider: { name: 'places', apiKey: 'sk-nested', token: 't-1' },
      upstream: { auth: { password: 'p-1', secret: 's-1' } },
    });

    const text = JSON.stringify(lines);
    for (const secret of ['sk-top', 'sk-nested', 't-1', 'p-1', 's-1']) {
      expect(text).not.toContain(secret);
    }
    expect(lines[0]).toMatchObject({
      apiKey: '[Redacted]',
      provider: { name: 'places', apiKey: '[Redacted]', token: '[Redacted]' },
      upstream: { auth: { password: '[Redacted]', secret: '[Redacted]' } },
    });
  });
});
