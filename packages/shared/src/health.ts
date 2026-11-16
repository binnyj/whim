import { z } from 'zod';

/** Response body of the API's `GET /health` endpoint. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
  uptime: z.number().nonnegative(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
