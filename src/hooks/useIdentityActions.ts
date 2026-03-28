import { useMutation, useQueryClient } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

export interface IdentityData {
  name: string;
  email: string;
  replyTo?: { name?: string; email: string }[] | null;
  textSignature?: string;
  htmlSignature?: string;
  bcc?: { name?: string; email: string }[] | null;
  sortOrder?: number;
}

export function useIdentityActions() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['identities'] });
  };

  const createIdentity = useMutation<unknown, Error, { tempId?: string } & IdentityData>({
    mutationFn: async ({ tempId = `new-${Date.now()}`, ...identityData }) => {
      return jmapClient.request([
        [
          'Identity/set',
          {
            accountId,
            create: { [tempId]: identityData },
          },
          '0',
        ],
      ]);
    },
    onSuccess: invalidate,
  });

  const updateIdentity = useMutation<
    unknown,
    Error,
    { identityId: string; updates: Partial<IdentityData> }
  >({
    mutationFn: async ({ identityId, updates }) => {
      return jmapClient.request([
        [
          'Identity/set',
          {
            accountId,
            update: { [identityId]: updates },
          },
          '0',
        ],
      ]);
    },
    onSuccess: invalidate,
  });

  const deleteIdentity = useMutation<unknown, Error, { identityId: string }>({
    mutationFn: async ({ identityId }) => {
      return jmapClient.request([
        [
          'Identity/set',
          {
            accountId,
            destroy: [identityId],
          },
          '0',
        ],
      ]);
    },
    onSuccess: invalidate,
  });

  return { createIdentity, updateIdentity, deleteIdentity };
}
