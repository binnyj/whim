import { vi } from 'vitest';

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/**
 * Replaces global `fetch` with a stub that answers each call with the next reply in order
 * (repeating the last one). Restored automatically by `vi.restoreAllMocks()` in test setup.
 */
export function mockFetch(...replies: Reply[]) {
  let call = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const reply = replies[Math.min(call++, replies.length - 1)];
    if (reply === undefined) throw new Error('mockFetch needs at least one reply');
    if (reply instanceof Error) return Promise.reject(reply);
    const { status = 200, body, headers } = reply;
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status, headers }));
  });
}

/** A fetch that never settles, for asserting loading states. */
export function mockPendingFetch() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(() => new Promise<Response>(() => undefined));
}
