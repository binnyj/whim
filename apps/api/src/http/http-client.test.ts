import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { RateLimitedError, UpstreamError } from '../errors.js';
import { memoryLogger } from '../test-utils/memory-logger.js';
import { createHttpClient, type HttpClientOptions } from './http-client.js';

const placeSchema = z.object({ id: z.string(), name: z.string() });

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function setup(responses: (Response | Error | 'hang')[], options: Partial<HttpClientOptions> = {}) {
  const queue = [...responses];
  const fetchMock = vi.fn((_url: URL, init?: RequestInit) => {
    const next = queue.shift();
    if (next === undefined) throw new Error('fetch called more times than expected');
    if (next === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'));
        });
      });
    }
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const sleep = vi.fn(() => Promise.resolve());
  const { logger, lines } = memoryLogger('debug');
  const client = createHttpClient({
    provider: 'places',
    baseUrl: 'https://places.example/v1/',
    logger,
    fetch: fetchMock as unknown as typeof fetch,
    sleep,
    random: () => 0.5,
    ...options,
  });
  const get = () => client.request({ path: 'places/p1', schema: placeSchema });
  return { client, fetchMock, sleep, lines, get };
}

const place = { id: 'p1', name: 'Blue Bottle' };

describe('createHttpClient', () => {
  it('returns the parsed, validated body on success', async () => {
    const { get, fetchMock } = setup([json({ ...place, extra: 'dropped' })]);

    await expect(get()).resolves.toEqual(place);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('builds the URL, query, headers and JSON body', async () => {
    const { client, fetchMock } = setup([json(place)], { headers: { authorization: 'Key k' } });

    await client.request({
      method: 'POST',
      path: 'places:search',
      query: { limit: 5, openNow: true, cursor: undefined },
      headers: { 'x-field-mask': 'id,name' },
      body: { text: 'coffee' },
      schema: placeSchema,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://places.example/v1/places:search?limit=5&openNow=true');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{"text":"coffee"}',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Key k',
        'x-field-mask': 'id,name',
      },
    });
  });

  it.each([
    ['https://routes.example/v2', '/matrix'],
    ['https://routes.example/v2/', 'matrix'],
  ])('keeps the base path for base %s and path %s', async (baseUrl, path) => {
    const { client, fetchMock } = setup([json(place)], { baseUrl });

    await client.request({ path, schema: placeSchema });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://routes.example/v2/matrix');
  });

  it('retries 5xx with growing backoff, then succeeds', async () => {
    const { get, fetchMock, sleep } = setup([json({}, 503), json({}, 500), json(place)]);

    await expect(get()).resolves.toEqual(place);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // random() = 0.5 → 75% of each ceiling: 200 ms, then 400 ms.
    expect(sleep.mock.calls).toEqual([[150], [300]]);
  });

  it('caps backoff at maxBackoffMs', async () => {
    const { get, sleep } = setup([json({}, 500), json({}, 500), json({}, 500), json(place)], {
      retries: 3,
      backoffMs: 1000,
      maxBackoffMs: 1500,
    });

    await get();

    expect(sleep.mock.calls).toEqual([[750], [1125], [1125]]);
  });

  it('gives up after the configured retries with UpstreamError', async () => {
    const { get, fetchMock } = setup([json({}, 502), json({}, 502), json({}, 502)]);

    const error = await get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).provider).toBe('places');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries network errors', async () => {
    const { get, fetchMock } = setup([new TypeError('fetch failed'), json(place)]);

    await expect(get()).resolves.toEqual(place);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('times out a hanging request and retries it', async () => {
    const { get, fetchMock } = setup(['hang', 'hang'], { timeoutMs: 10, retries: 1 });

    const error = await get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(((error as UpstreamError).cause as Error).message).toBe('Timed out after 10 ms');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows a per-request timeout', async () => {
    const { client } = setup(['hang'], { timeoutMs: 60_000, retries: 0 });

    const error = await client
      .request({ path: 'slow', schema: placeSchema, timeoutMs: 5 })
      .catch((e: unknown) => e);

    expect(((error as UpstreamError).cause as Error).message).toBe('Timed out after 5 ms');
  });

  it.each([400, 401, 403, 404])('does not retry %i', async (status) => {
    const { get, fetchMock } = setup([json({ error: 'nope' }, status)]);

    await expect(get()).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('maps 429 to RateLimitedError with Retry-After, without retrying', async () => {
    const { get, fetchMock } = setup([json({}, 429, { 'retry-after': '12' })]);

    const error = await get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterSeconds).toBe(12);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('ignores a non-numeric Retry-After', async () => {
    const { get } = setup([json({}, 429, { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' })]);

    const error = (await get().catch((e: unknown) => e)) as RateLimitedError;

    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it('fails without retrying when the body does not match the schema', async () => {
    const { get, fetchMock } = setup([json({ id: 42 })]);

    const error = await get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect(((error as UpstreamError).cause as Error).message).toMatch(/expected schema/);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('fails when the body is not JSON', async () => {
    const { get } = setup([new Response('<html>oops</html>', { status: 200 })]);

    await expect(get()).rejects.toBeInstanceOf(UpstreamError);
  });

  it('treats an empty body as undefined for the schema', async () => {
    const { client } = setup([new Response(null, { status: 204 })]);

    await expect(client.request({ path: 'ping', schema: z.undefined() })).resolves.toBeUndefined();
  });

  it('logs every attempt with status and duration but never the query string', async () => {
    const { client, lines } = setup([json({}, 503), json(place)]);

    await client.request({ path: 'places/p1', query: { key: 'sk-secret' }, schema: placeSchema });

    expect(lines).toEqual([
      expect.objectContaining({
        level: 40,
        provider: 'places',
        method: 'GET',
        url: 'https://places.example/v1/places/p1',
        attempt: 1,
        status: 503,
        msg: 'Upstream call failed',
      }),
      expect.objectContaining({
        level: 20,
        attempt: 2,
        status: 200,
        msg: 'Upstream call succeeded',
      }),
    ]);
    expect(typeof lines[1]?.durationMs).toBe('number');
    expect(JSON.stringify(lines)).not.toContain('sk-secret');
  });
});
