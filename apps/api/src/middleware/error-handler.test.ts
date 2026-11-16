import { errorResponseSchema } from '@whim/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError, RateLimitedError, UpstreamError, ValidationError } from '../errors.js';
import { errorHandler, notFoundHandler } from './error-handler.js';

/** A tiny app whose routes throw each kind of error, behind the real error middleware. */
function buildApp() {
  const logError = vi.fn();
  const app = express();
  app.use(express.json());

  app.get('/validation', () => {
    throw new ValidationError('Invalid request', {
      details: [{ path: 'mood', message: 'Required' }],
    });
  });
  app.get('/not-found', async () => {
    await Promise.resolve();
    throw new NotFoundError('Activity not found');
  });
  app.get('/rate-limited', () => {
    throw new RateLimitedError(undefined, 30);
  });
  app.get('/rate-limited-no-retry', () => {
    throw new RateLimitedError();
  });
  app.get('/upstream', () => {
    throw new UpstreamError('places', { cause: new Error('ECONNRESET to places.example') });
  });
  app.get('/bug', () => {
    throw new Error('secret connection string leaked');
  });
  app.get('/thrown-string', () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- simulating a misbehaving library
    throw 'boom';
  });
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });

  app.use(notFoundHandler);
  app.use(errorHandler({ logError }));
  return { app, logError };
}

describe('error handler', () => {
  it.each([
    ['/validation', 400, 'VALIDATION_ERROR', 'Invalid request'],
    ['/not-found', 404, 'NOT_FOUND', 'Activity not found'],
    ['/rate-limited', 429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again.'],
    [
      '/upstream',
      502,
      'UPSTREAM_ERROR',
      'A service we depend on is unavailable. Please try again shortly.',
    ],
  ])('maps %s to %i %s', async (path, status, code, message) => {
    const { app } = buildApp();

    const res = await request(app).get(path);

    expect(res.status).toBe(status);
    expect(errorResponseSchema.parse(res.body).error).toMatchObject({ code, message });
  });

  it('includes details when the error has them', async () => {
    const res = await request(buildApp().app).get('/validation');

    expect((res.body as { error: { details: unknown } }).error.details).toEqual([
      { path: 'mood', message: 'Required' },
    ]);
  });

  it('omits details when the error has none', async () => {
    const res = await request(buildApp().app).get('/not-found');

    expect((res.body as { error: object }).error).not.toHaveProperty('details');
  });

  it('sets Retry-After on rate limits when known', async () => {
    const { app } = buildApp();

    expect((await request(app).get('/rate-limited')).headers['retry-after']).toBe('30');
    expect(
      (await request(app).get('/rate-limited-no-retry')).headers['retry-after'],
    ).toBeUndefined();
  });

  it('does not leak the upstream cause to the client but logs it', async () => {
    const { app, logError } = buildApp();

    const res = await request(app).get('/upstream');

    expect(res.text).not.toContain('ECONNRESET');
    expect(res.text).not.toContain('places');
    expect(logError).toHaveBeenCalledOnce();
  });

  it.each(['/bug', '/thrown-string'])('sanitizes unknown errors from %s as 500', async (path) => {
    const { app, logError } = buildApp();

    const res = await request(app).get(path);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
    expect(res.text).not.toContain('secret');
    expect(res.text).not.toContain('at ');
    expect(logError).toHaveBeenCalledOnce();
  });

  it('does not log client errors', async () => {
    const { app, logError } = buildApp();

    await request(app).get('/validation');
    await request(app).get('/nope');

    expect(logError).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(buildApp().app).delete('/nope');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found: DELETE /nope' },
    });
  });

  it('returns 400 BAD_REQUEST for malformed JSON bodies', async () => {
    const res = await request(buildApp().app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"mood": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON.' },
    });
  });
});
