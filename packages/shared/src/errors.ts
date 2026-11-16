import { z } from 'zod';

/** Machine-readable error codes the API can return. The web app branches on these, not on messages. */
export const errorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Body of every API error response: `{ error: { code, message, details? } }`. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** One field-level problem in a `VALIDATION_ERROR`'s `details` array. */
export const validationIssueSchema = z.object({
  /** Which part of the request was invalid. */
  location: z.enum(['body', 'query', 'params']),
  /** Dot-separated path to the field, e.g. `location.lat`; empty when the whole part is invalid. */
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
