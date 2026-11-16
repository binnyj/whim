import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConfigError, loadConfig, parseEnv } from './config.js';

describe('loadConfig', () => {
  it('applies defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('parses and coerces valid values', () => {
    expect(loadConfig({ NODE_ENV: 'production', PORT: '8080', LOG_LEVEL: 'warn' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'warn',
    });
  });

  it('treats empty strings as unset', () => {
    expect(loadConfig({ PORT: '' }).PORT).toBe(3000);
  });

  it('ignores unrelated variables', () => {
    expect(loadConfig({ HOME: '/home/someone' })).not.toHaveProperty('HOME');
  });

  it.each([
    ['PORT', { PORT: 'abc' }],
    ['PORT', { PORT: '70000' }],
    ['NODE_ENV', { NODE_ENV: 'staging' }],
    ['LOG_LEVEL', { LOG_LEVEL: 'loud' }],
  ])('rejects an invalid %s and names it', (name, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(new RegExp(`- ${name}: `));
  });
});

describe('parseEnv', () => {
  const schema = z.object({ API_KEY: z.string(), REGION: z.string(), PORT: z.coerce.number() });

  it('names every missing required variable', () => {
    try {
      parseEnv(schema, { PORT: '1' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).problems).toEqual([
        'API_KEY: required but not set',
        'REGION: required but not set',
      ]);
      expect((error as ConfigError).message).toContain('Invalid environment configuration');
    }
  });

  it('treats an empty required variable as missing', () => {
    expect(() => parseEnv(schema, { API_KEY: '', REGION: 'eu', PORT: '1' })).toThrow(
      /API_KEY: required but not set/,
    );
  });
});
