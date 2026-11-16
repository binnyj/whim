import { describe, expect, it } from 'vitest';

import { errorResponseSchema, validationIssueSchema } from './errors.js';

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

describe('validationIssueSchema', () => {
  it('parses an issue', () => {
    const issue = { location: 'body', path: 'location.lat', message: 'Too big' };

    expect(validationIssueSchema.parse(issue)).toEqual(issue);
  });

  it('rejects an unknown location', () => {
    expect(
      validationIssueSchema.safeParse({ location: 'headers', path: '', message: 'x' }).success,
    ).toBe(false);
  });
});
