import { useQuery } from '@tanstack/react-query';
import { healthResponseSchema } from '@whim/shared';

import { apiClient } from '../../api/client';

export const healthQueryKey = ['health'] as const;

/** The API's `/health` status, fetched and cached through TanStack Query. */
export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/health', schema: healthResponseSchema, signal }),
  });
}
