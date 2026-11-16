// Placeholder entry; replaced by the app factory + server bootstrap in P0-07.
import { type HealthResponse, healthResponseSchema } from '@whim/shared';

export function buildHealthResponse(version: string, uptime: number): HealthResponse {
  return healthResponseSchema.parse({ status: 'ok', version, uptime });
}
