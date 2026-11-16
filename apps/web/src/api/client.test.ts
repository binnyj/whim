import { healthResponseSchema } from '@whim/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from './api-error';
import { createApiClient } from './client';

const health = { status: 'ok', version: '1.0.0', uptime: 3 };

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(text, { status, headers });
}

/** Resolves with a Response, or rejects with anything else (errors, aborts). */
function setup(result: Response | Error | DOMException, baseUrl = '') {
  const fetchMock = vi.fn((_input: string, _init?: RequestInit) =>
    result instanceof Response ? Promise.resolve(result) : Promise.reject(result),
  );
  const client = createApiClient({ baseUrl, fetch: fetchMock as unknown as typeof fetch });
  return { client, fetchMock };
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('createApiClient', () => {
  it('parses a successful response with the given schema', async () => {
    const { client } = setup(respond({ ...health, extra: 'dropped' }));

    await expect(
      client.request({ path: '/health', schema: healthResponseSchema }),
    ).resolves.toEqual(health);
  });

  it('builds the URL, query string, headers and JSON body', async () => {
    const { client, fetchMock } = setup(respond({ ok: true }), 'https://api.whim.example');

    await client.request({
      method: 'POST',
      path: '/api/discover',
      query: { limit: 10, openNow: true, cursor: undefined },
      body: { mood: 'relaxed' },
      schema: z.object({ ok: z.boolean() }),
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.whim.example/api/discover?limit=10&openNow=true');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"mood":"relaxed"}',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
    });
  });

  it('turns the API error envelope into a typed ApiError', async () => {
    const { client } = setup(
      respond(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: [{ location: 'body', path: 'mood', message: 'Required' }],
          },
        },
        400,
        { 'x-request-id': 'req-1' },
      ),
    );

    const error = await failure(client.request({ path: '/api/discover', schema: z.unknown() }));

    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      status: 400,
      requestId: 'req-1',
      details: [{ location: 'body', path: 'mood', message: 'Required' }],
    });
  });

  it('surfaces a schema mismatch as INVALID_RESPONSE with the broken fields', async () => {
    const { client } = setup(
      respond({ status: 'ok', version: 1 }, 200, { 'x-request-id': 'req-2' }),
    );

    const error = await failure(client.request({ path: '/health', schema: healthResponseSchema }));

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200, requestId: 'req-2' });
    expect((error.details as { path: string[] }[]).map((issue) => issue.path.join('.'))).toEqual([
      'version',
      'uptime',
    ]);
  });

  it('treats a non-JSON success body as INVALID_RESPONSE', async () => {
    const { client } = setup(respond('<!doctype html><p>index.html</p>'));

    expect((await failure(client.request({ path: '/health', schema: z.unknown() }))).code).toBe(
      'INVALID_RESPONSE',
    );
  });

  it.each([
    ['a 502 HTML page', respond('<h1>Bad Gateway</h1>', 502), 'UNAVAILABLE'],
    ['an empty 504', respond('', 504), 'UNAVAILABLE'],
    ['a 404 without our envelope', respond('Not Found', 404), 'INVALID_RESPONSE'],
    [
      'a 400 with a malformed envelope',
      respond({ error: { code: 'TEAPOT' } }, 400),
      'INVALID_RESPONSE',
    ],
  ])('maps %s to %s', async (_label, response, code) => {
    const { client } = setup(response);

    const error = await failure(client.request({ path: '/health', schema: z.unknown() }));

    expect(error.code).toBe(code);
    expect(error.status).toBe(response.status);
  });

  it('maps a failed fetch to NETWORK_ERROR', async () => {
    const { client } = setup(new TypeError('Failed to fetch'));

    const error = await failure(client.request({ path: '/health', schema: z.unknown() }));

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBeUndefined();
  });

  it('lets cancellations through untouched', async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException('Aborted', 'AbortError');
    const { client } = setup(abort);

    await expect(
      client.request({ path: '/health', schema: z.unknown(), signal: controller.signal }),
    ).rejects.toBe(abort);
  });
});
