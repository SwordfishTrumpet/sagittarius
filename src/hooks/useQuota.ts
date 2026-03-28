import { useQuery } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

export interface JMAPQuota {
  id: string;
  resourceType: string;
  used: number;
  hardLimit: number;
  warnLimit?: number;
  softLimit?: number;
  name?: string;
  scope?: string;
  types?: string[];
}

export function useQuota() {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery<JMAPQuota | null>({
    queryKey: ['quota', accountId],
    queryFn: async () => {
      if (!jmapClient.hasCapability('urn:ietf:params:jmap:quotas')) return null;

      const response = await jmapClient.request(
        [['Quota/get', { accountId, ids: null }, '0']],
        ['urn:ietf:params:jmap:quotas'],
      );

      const list: JMAPQuota[] = response.methodResponses[0][1].list || [];

      // Prefer octets (storage) quota; fall back to first available
      return list.find((q) => q.resourceType === 'octets') ?? list[0] ?? null;
    },
    enabled: !!accountId,
    staleTime: 15 * 60 * 1000,
  });
}
