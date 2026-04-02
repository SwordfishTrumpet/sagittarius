import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { extractGetResponse } from '../types/jmap';

export interface VacationResponse {
  id: string;
  isEnabled: boolean;
  fromDate?: string | null;
  toDate?: string | null;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
}

export function useVacation() {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery<VacationResponse | null>({
    queryKey: ['vacation', accountId],
    queryFn: async () => {
      const response = await jmapClient.request(
        [['VacationResponse/get', { accountId, ids: null }, '0']],
        ['urn:ietf:params:jmap:vacationresponse']
      );

      const result = extractGetResponse<VacationResponse>(response.methodResponses);
      const list: VacationResponse[] = result?.list ?? [];
      return list[0] ?? null;
    },
    enabled: !!accountId,
    staleTime: 10 * 60 * 1000,
  });
}

export type VacationUpdatePayload = Partial<Omit<VacationResponse, 'id'>>;

export function useVacationUpdate() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, VacationUpdatePayload>({
    mutationFn: async (updatePayload) => {
      return jmapClient.request(
        [
          [
            'VacationResponse/set',
            {
              accountId,
              update: { singleton: updatePayload },
            },
            '0',
          ],
        ],
        ['urn:ietf:params:jmap:vacationresponse']
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation'] });
    },
  });
}
