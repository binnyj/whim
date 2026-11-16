import { z } from 'zod';

import { LOG_LEVELS } from './logger.js';

/** Every environment variable the API reads. Add new ones here and to `.env.example`. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export type Config = z.infer<typeof envSchema>;

/** Thrown when the environment doesn't match the schema; the message lists every bad variable. */
export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

/**
 * Parses `env` through `schema`, failing fast with a readable error that names each bad variable.
 * Empty strings count as unset, so `PORT=` falls back to the default instead of failing as 0.
 */
export function parseEnv<S extends z.ZodType>(schema: S, env: Env): z.infer<S> {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);

  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    return cleaned[name] === undefined
      ? `${name}: required but not set`
      : `${name}: ${issue.message}`;
  });
  throw new ConfigError(problems);
}

/** Loads the API's config from `process.env` (or a given env, for tests). */
export function loadConfig(env: Env = process.env): Config {
  return parseEnv(envSchema, env);
}
