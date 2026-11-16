import { errorResponseSchema, type ValidationIssue } from '@whim/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { errorHandler } from './error-handler.js';
import { validate } from './validate.js';

const params = z.object({ id: z.string().regex(/^act_\w+$/, 'Must be an activity ID') });
const body = z.object({
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  mood: z.enum(['relaxed', 'adventurous']),
});
const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  openNow: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

function buildApp() {
  const app = express();
  app.use(express.json());

  app.post('/activities/:id', validate({ params, body, query }), (req, res) => {
    // Compile-time check: later handlers see the parsed types.
    expectTypeOf(req.params.id).toEqualTypeOf<string>();
    expectTypeOf(req.body.location.lat).toEqualTypeOf<number>();
    expectTypeOf(req.query.limit).toEqualTypeOf<number>();
    expectTypeOf(req.query.openNow).toEqualTypeOf<boolean | undefined>();

    res.json({ params: req.params, body: req.body, query: req.query });
  });

  app.get('/only-query', validate({ query }), (req, res) => {
    res.json(req.query);
  });

  app.use(errorHandler({ logError: () => undefined }));
  return app;
}

const validBody = { location: { lat: 51.5, lng: -0.12 }, mood: 'relaxed' };

function issuesOf(resBody: unknown): ValidationIssue[] {
  return errorResponseSchema.parse(resBody).error.details as ValidationIssue[];
}

describe('validate', () => {
  it('passes valid input through with parsed values', async () => {
    const res = await request(buildApp())
      .post('/activities/act_123?limit=5&openNow=true')
      .send({ ...validBody, extra: 'ignored' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id: 'act_123' },
      body: validBody,
      query: { limit: 5, openNow: true },
    });
  });

  it('applies defaults', async () => {
    const res = await request(buildApp()).get('/only-query');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ limit: 10 });
  });

  it('returns 400 with every problem across params, body and query', async () => {
    const res = await request(buildApp())
      .post('/activities/oops?limit=500')
      .send({ location: { lat: 200, lng: 0 } });

    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
    });
    expect(issuesOf(res.body).map(({ location, path }) => `${location}:${path}`)).toEqual([
      'params:id',
      'body:location.lat',
      'body:mood',
      'query:limit',
    ]);
  });

  it('uses the schema message for each issue', async () => {
    const res = await request(buildApp()).post('/activities/oops').send(validBody);

    expect(issuesOf(res.body)).toEqual([
      { location: 'params', path: 'id', message: 'Must be an activity ID' },
    ]);
  });

  it('reports a missing body against the whole body', async () => {
    const res = await request(buildApp()).post('/activities/act_1');

    expect(res.status).toBe(400);
    expect(issuesOf(res.body)).toEqual([
      expect.objectContaining({ location: 'body', path: '' }) as ValidationIssue,
    ]);
  });

  it('only validates the parts it was given', async () => {
    const res = await request(buildApp()).get('/only-query?limit=3&unrelated=x');

    expect(res.body).toEqual({ limit: 3 });
  });
});
