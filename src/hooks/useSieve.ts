import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { extractGetResponse } from '../types/jmap';

const SIEVE_CAP = 'urn:ietf:params:jmap:sieve';

export interface SieveScript {
  id: string;
  name: string;
  blobId: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// useSieve — fetch all sieve scripts
// ---------------------------------------------------------------------------
export function useSieve() {
  const accountId = jmapClient.getPrimaryAccount();
  const supported = jmapClient.hasCapability(SIEVE_CAP);

  return useQuery<SieveScript[] | null>({
    queryKey: ['sieve', accountId],
    queryFn: async () => {
      if (!supported) return null;

      const response = await jmapClient.request(
        [
          [
            'SieveScript/get',
            { accountId, ids: null },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') return null;

      const result = extractGetResponse<SieveScript>(response.methodResponses);
      return result?.list ?? [];
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useSieveActions — create / update / delete / validate / activate scripts
// ---------------------------------------------------------------------------
export function useSieveActions() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['sieve'] });

  // Create a new Sieve script
  const createScript = useMutation({
    mutationFn: async ({
      name,
      blobId,
      isActive = false,
    }: {
      name: string;
      blobId: string;
      isActive?: boolean;
    }) => {
      return jmapClient.request(
        [
          [
            'SieveScript/set',
            {
              accountId,
              create: {
                'new-1': { name, blobId, isActive },
              },
            },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );
    },
    onSuccess: invalidate,
  });

  // Update an existing Sieve script
  const updateScript = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<SieveScript, 'name' | 'blobId' | 'isActive'>>;
    }) => {
      return jmapClient.request(
        [
          [
            'SieveScript/set',
            {
              accountId,
              update: { [id]: patch },
            },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );
    },
    onSuccess: invalidate,
  });

  // Delete a Sieve script
  const deleteScript = useMutation({
    mutationFn: async (id: string) => {
      return jmapClient.request(
        [
          [
            'SieveScript/set',
            {
              accountId,
              destroy: [id],
            },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );
    },
    onSuccess: invalidate,
  });

  // Validate a Sieve script blob
  const validateScript = useMutation({
    mutationFn: async (blobId: string) => {
      const response = await jmapClient.request(
        [
          [
            'SieveScript/validate',
            { accountId, blobId },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );
      const res = response.methodResponses[0];
      if (res[0] === 'error') {
        const errorResult = res[1] as { description?: string } | undefined;
        throw new Error(errorResult?.description || 'Validation failed');
      }
      // SieveScript/validate returns an empty object on success
      return res[1];
    },
    onSuccess: invalidate,
  });

  // Activate a specific Sieve script (set isActive: true)
  const activateScript = useMutation({
    mutationFn: async (id: string) => {
      return jmapClient.request(
        [
          [
            'SieveScript/set',
            {
              accountId,
              update: { [id]: { isActive: true } },
            },
            '0',
          ],
        ],
        [SIEVE_CAP],
      );
    },
    onSuccess: invalidate,
  });

  return { createScript, updateScript, deleteScript, validateScript, activateScript };
}
