import { errorResponseSchema } from '@whim/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('createApp', () => {
  it('answers unknown routes with the 404 error envelope', async () => {
    const res = await request(createApp({ version: '1.0.0' })).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});
