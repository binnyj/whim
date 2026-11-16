import type { ValidationIssue } from '@whim/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';

import { ValidationError } from '../errors.js';

type Location = ValidationIssue['location'];

interface Schemas<P, B, Q> {
  params?: P;
  body?: B;
  query?: Q;
}

/** Type of a request part: the schema's output when one is given, otherwise Express's default. */
type Parsed<S, Fallback> = S extends z.ZodType ? z.output<S> : Fallback;

/**
 * Validates `req.params`, `req.body` and `req.query` against Zod schemas before the route runs.
 *
 * On success each validated part is replaced by its parsed value (coerced, defaulted, unknown keys
 * stripped), and later handlers on the same route see the parsed types. On failure it throws a
 * `ValidationError` listing every problem across all parts, which the error handler turns into a 400.
 */
export function validate<
  P extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
>(
  schemas: Schemas<P, B, Q>,
): RequestHandler<
  Parsed<P, Record<string, string>>,
  unknown,
  Parsed<B, unknown>,
  Parsed<Q, Record<string, unknown>>
> {
  const checks = (['params', 'body', 'query'] as const).flatMap((part) => {
    const schema: z.ZodType | undefined = schemas[part];
    return schema ? [{ part, schema }] : [];
  });

  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];
    const parsed: Partial<Record<Location, unknown>> = {};

    for (const { part, schema } of checks) {
      const result = schema.safeParse(req[part]);
      if (result.success) {
        parsed[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ location: part, path: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      next(new ValidationError('Invalid request', { details: issues }));
      return;
    }

    for (const { part } of checks) {
      // Express 5 exposes `req.query` as a getter, so shadow it with an own property instead of assigning.
      Object.defineProperty(req, part, {
        value: parsed[part],
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}
