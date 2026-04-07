import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { createJMAPSingletonHook } from './jmap/jmapHookFactory';
import type { VacationResponse } from '../types/jmap';

const VACATION_CAP = 'urn:ietf:params:jmap:vacationresponse';

// Use the singleton hook factory for the VacationResponse/get query
export const useVacation = createJMAPSingletonHook<VacationResponse>(
  'VacationResponse/get',
  'vacation',
  {
    capability: VACATION_CAP,
    staleTime: 10 * 60 * 1000, // 10 minutes
  }
);

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
