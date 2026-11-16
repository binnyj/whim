import { healthResponseSchema } from '@whim/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

describe('GET /health', () => {
  const app = createApp({ version: '1.2.3', getUptime: () => 42 });

  it('returns 200 with status, version and uptime', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok', version: '1.2.3', uptime: 42 });
  });

  it('matches the shared health schema', async () => {
    const res = await request(app).get('/health');

    expect(healthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('reports live uptime by default', async () => {
    const res = await request(createApp({ version: '1.2.3' })).get('/health');

    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof (res.body as { uptime: unknown }).uptime).toBe('number');
  });

  it('does not advertise Express', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
