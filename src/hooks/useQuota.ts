import { createJMAPQueryHook } from './jmap/jmapHookFactory';
import type { Quota } from '../types/jmap';

const QUOTA_CAP = 'urn:ietf:params:jmap:quotas';

// Re-export the Quota type for backwards compatibility
export type JMAPQuota = Quota;

/**
 * Hook to fetch quota information using the JMAP factory.
 * Returns the storage quota (octets) or the first available quota.
 */
export const useQuota = createJMAPQueryHook<Quota | null>(
  'Quota/get',
  'quota',
  {
    capability: QUOTA_CAP,
    staleTime: 15 * 60 * 1000, // 15 minutes
    transform: (response) => {
      const result = response.methodResponses[0]?.[1] as { list?: Quota[] } | undefined;
      const list = result?.list ?? [];
      // Prefer octets (storage) quota; fall back to first available
      return list.find((q) => q.resourceType === 'octets') ?? list[0] ?? null;
    },
  }
);
