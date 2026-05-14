import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import { createJMAPListHook } from './jmap/jmapHookFactory';

const SIEVE_CAP = 'urn:ietf:params:jmap:sieve';

// ============ Capability Check ============

export function hasSieveCapability(): boolean {
  return jmapClient.hasCapability(SIEVE_CAP);
}

export function useHasSieveCapability(): boolean {
  const accountId = jmapClient.getPrimaryAccount();
  return !!(hasSieveCapability() && accountId);
}

export interface SieveScript {
  id: string;
  name: string;
  blobId: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// useSieve — fetch all sieve scripts using the JMAP hook factory
// ---------------------------------------------------------------------------
export const useSieve = createJMAPListHook<SieveScript>(
  'SieveScript/get',
  'sieve',
  {
    capability: SIEVE_CAP,
    staleTime: 5 * 60 * 1000, // 5 minutes
  }
);

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

  // Activate a specific Sieve script (RFC 9661 §5.4)
  const activateScript = useMutation({
    mutationFn: async (id: string) => {
      return jmapClient.request(
        [
          [
            'SieveScript/activate',
            {
              accountId,
              id,
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
