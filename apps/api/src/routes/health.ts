import { type HealthResponse, healthResponseSchema } from '@whim/shared';
import { Router } from 'express';

export interface HealthDeps {
  version: string;
  getUptime: () => number;
}

export function healthRouter({ version, getUptime }: HealthDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({
      status: 'ok',
      version,
      uptime: getUptime(),
    });
    res.json(body);
  });

  return router;
}
