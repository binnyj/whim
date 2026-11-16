// Placeholder entry; replaced by the Vite + React app shell in P0-14.
import { type HealthResponse, healthResponseSchema } from '@whim/shared';

export function parseHealthResponse(body: unknown): HealthResponse {
  return healthResponseSchema.parse(body);
}
