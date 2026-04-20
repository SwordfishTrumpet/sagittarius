import { useQuery } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { fetchWithOfflineCache } from '../../utils/offlineCache'
import { extractGetResponse, type Identity } from '../../types/jmap'

const SUBMISSION_CAP = 'urn:ietf:params:jmap:submission';

// ============ Capability Check ============

export function hasIdentityCapability(): boolean {
  return jmapClient.hasCapability(SUBMISSION_CAP);
}

export function useHasIdentityCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasIdentityCapability() && accountId);
}

export function useIdentities() {
  const accountId = jmapClient.getPrimaryAccount()
  return useQuery({
    queryKey: ['identities', accountId],
    queryFn: async () => fetchWithOfflineCache(['identities', accountId], async () => {
      const response = await jmapClient.request([
        ['Identity/get', { accountId, ids: null }, '0'],
      ])
      const result = extractGetResponse<Identity>(response.methodResponses)
      return result?.list ?? []
    }),
    enabled: !!accountId,
    staleTime: 30 * 60 * 1000,
  })
}
