import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('parses a valid health response', () => {
    const input = { status: 'ok', version: '0.0.0', uptime: 12.5 };

    expect(healthResponseSchema.parse(input)).toEqual(input);
  });

  it('strips unknown fields', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      version: '0.0.0',
      uptime: 0,
      extra: true,
    });

    expect(parsed).not.toHaveProperty('extra');
  });

  it.each([
    ['wrong status', { status: 'down', version: '0.0.0', uptime: 1 }],
    ['empty version', { status: 'ok', version: '', uptime: 1 }],
    ['negative uptime', { status: 'ok', version: '0.0.0', uptime: -1 }],
    ['missing uptime', { status: 'ok', version: '0.0.0' }],
    ['not an object', 'ok'],
  ])('rejects %s', (_label, input) => {
    expect(healthResponseSchema.safeParse(input).success).toBe(false);
  });
});
