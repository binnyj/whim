import { QueryClient } from '@tanstack/react-query';

import { isTransient } from './api-error';

/** Retries transient failures (network, 5xx) up to 2 more times; never retries 4xx or bad responses. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isTransient(error);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        // Results shouldn't reshuffle just because the user switched tabs and came back.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
