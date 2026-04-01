import { useQuery } from '@tanstack/react-query'
import { jmapClient } from '../../api/jmap'
import { fetchWithOfflineCache } from '../../utils/offlineCache'

export function useIdentities() {
  const accountId = jmapClient.getPrimaryAccount()
  return useQuery({
    queryKey: ['identities', accountId],
    queryFn: async () => fetchWithOfflineCache(['identities', accountId], async () => {
      const response = await jmapClient.request([
        ['Identity/get', { accountId, ids: null }, '0'],
      ])
      return response.methodResponses[0][1].list || []
    }),
    enabled: !!accountId,
    staleTime: 30 * 60 * 1000,
  })
}
