import { describe, expect, it } from 'vitest';

import { ApiError, type ApiErrorCode } from './api-error';
import { createQueryClient, shouldRetry } from './query-client';

const error = (code: ApiErrorCode) => new ApiError({ code, message: 'x' });

describe('shouldRetry', () => {
  it.each<ApiErrorCode>(['NETWORK_ERROR', 'UNAVAILABLE', 'UPSTREAM_ERROR', 'INTERNAL_ERROR'])(
    'retries %s up to twice',
    (code) => {
      expect(shouldRetry(0, error(code))).toBe(true);
      expect(shouldRetry(1, error(code))).toBe(true);
      expect(shouldRetry(2, error(code))).toBe(false);
    },
  );

  it.each<ApiErrorCode>([
    'BAD_REQUEST',
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'RATE_LIMITED',
    'INVALID_RESPONSE',
  ])('never retries %s', (code) => {
    expect(shouldRetry(0, error(code))).toBe(false);
  });

  it('never retries errors that are not ApiErrors', () => {
    expect(shouldRetry(0, new Error('bug'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('applies the app defaults', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();

    expect(queries).toMatchObject({ retry: shouldRetry, refetchOnWindowFocus: false });
    expect(mutations).toMatchObject({ retry: false });
  });
});
