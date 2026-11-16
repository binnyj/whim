import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { memoryLogger } from '../test-utils/memory-logger.js';
import { errorHandler } from './error-handler.js';
import { requestLogger, resolveRequestId } from './request-logger.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup() {
  const { logger, lines } = memoryLogger('debug');
  const app = createApp({ version: '1.0.0', logger });
  /** pino-http logs when the response finishes, which can land just after supertest resolves. */
  const completionLines = async (count: number) => {
    await vi.waitFor(() => {
      expect(lines.filter((l) => l.responseTime !== undefined)).toHaveLength(count);
    });
    return lines.filter((l) => l.responseTime !== undefined);
  };
  return { app, lines, completionLines };
}

describe('resolveRequestId', () => {
  it.each([
    ['a plain ID', 'abc-123_x.y', 'abc-123_x.y'],
    ['a 128-char ID', 'a'.repeat(128), 'a'.repeat(128)],
  ])('reuses %s', (_label, inbound, expected) => {
    expect(resolveRequestId(inbound)).toBe(expected);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too long', 'a'.repeat(129)],
    ['with spaces or newlines', 'abc\nINFO fake log line'],
    ['repeated header', ['a', 'b']],
  ])('generates a UUID when the inbound ID is %s', (_label, inbound) => {
    expect(resolveRequestId(inbound)).toMatch(UUID);
  });
});

describe('requestLogger', () => {
  it('generates a request ID and echoes it in the response header', async () => {
    const { app } = setup();

    const res = await request(app).get('/nope');

    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('reuses a safe inbound request ID', async () => {
    const { app } = setup();

    const res = await request(app).get('/nope').set('x-request-id', 'trace-42');

    expect(res.headers['x-request-id']).toBe('trace-42');
  });

  it('logs one line per request with the request ID, status and duration', async () => {
    const { app, completionLines } = setup();

    const res = await request(app).get('/nope?x=1');

    const [line] = await completionLines(1);
    expect(line).toMatchObject({
      level: 40,
      reqId: res.headers['x-request-id'],
      req: { method: 'GET', url: '/nope?x=1' },
      res: { statusCode: 404 },
    });
    expect(typeof line?.responseTime).toBe('number');
  });

  it('redacts credentials in logged request headers', async () => {
    const { app, lines, completionLines } = setup();

    await request(app)
      .get('/nope')
      .set('Authorization', 'Bearer super-secret')
      .set('Cookie', 'session=abc123')
      .set('x-api-key', 'key-123');

    const [line] = await completionLines(1);
    expect(line).toMatchObject({
      req: {
        headers: {
          authorization: '[Redacted]',
          cookie: '[Redacted]',
          'x-api-key': '[Redacted]',
        },
      },
    });
    const text = JSON.stringify(lines);
    expect(text).not.toContain('super-secret');
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('key-123');
  });

  it('does not log health checks', async () => {
    const { app, lines } = setup();

    await request(app).get('/health');
    await request(app).get('/health?probe=1');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(lines).toEqual([]);
  });

  it('stamps the request ID on errors logged during the request', async () => {
    const { logger, lines } = memoryLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get('/bug', () => {
      throw new Error('kaboom');
    });
    app.use(
      errorHandler({
        logError: (error, req) => {
          req.log.error({ err: error }, 'Request failed');
        },
      }),
    );

    const res = await request(app).get('/bug').set('x-request-id', 'trace-500');

    await vi.waitFor(() => {
      expect(lines).toHaveLength(2);
    });
    expect(lines[0]).toMatchObject({
      level: 50,
      msg: 'Request failed',
      reqId: 'trace-500',
      err: { message: 'kaboom' },
    });
    expect(lines[1]).toMatchObject({ level: 50, reqId: 'trace-500', res: { statusCode: 500 } });
    expect(res.text).not.toContain('kaboom');
  });
});
