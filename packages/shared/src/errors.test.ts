import { describe, expect, it } from 'vitest';

import { errorResponseSchema } from './errors.js';

describe('errorResponseSchema', () => {
  it('parses an error with details', () => {
    const body = {
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [{ path: 'mood' }] },
    };

    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it('parses an error without details', () => {
    const body = { error: { code: 'NOT_FOUND', message: 'Route not found' } };

    expect(errorResponseSchema.parse(body)).toEqual(body);
  });

  it.each([
    ['unknown code', { error: { code: 'TEAPOT', message: 'x' } }],
    ['empty message', { error: { code: 'NOT_FOUND', message: '' } }],
    ['missing envelope', { code: 'NOT_FOUND', message: 'x' }],
  ])('rejects %s', (_label, body) => {
    expect(errorResponseSchema.safeParse(body).success).toBe(false);
  });
});
