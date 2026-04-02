import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jmapClient } from '../api/jmap';
import { sharedNotificationSuppressor } from '../utils/notificationSuppressor';
import { invalidateEmailQueries } from './jmap/queryCacheUtils';
import type { JMAPSetResponse, Email, JMAPSetError } from '../types/jmap';

export interface EmailImportParams {
  blobId: string;
  mailboxIds: Record<string, boolean>;
  keywords?: Record<string, boolean>;
}

/**
 * useEmailImport — imports a raw .eml blob into a JMAP mailbox via Email/import.
 */
export function useEmailImport() {
  const accountId = jmapClient.getPrimaryAccount();
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: () => {
      sharedNotificationSuppressor.suppress();
    },
    mutationFn: async ({ blobId, mailboxIds, keywords }: EmailImportParams) => {
      // ... (same mutation logic)
      const createObj: Record<string, any> = {
        blobId,
        mailboxIds,
        receivedAt: new Date().toISOString(),
      };
      if (keywords) createObj.keywords = keywords;

      const response = await jmapClient.request([
        [
          'Email/import',
          {
            accountId,
            emails: {
              'import-1': createObj,
            },
          },
          '0',
        ],
      ]);

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        const errorResult = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(errorResult?.description || 'Import failed');
      }

      const importResult = methodRes[1] as JMAPSetResponse<Email>;
      const notCreated = importResult?.notCreated;
      if (notCreated && Object.keys(notCreated).length > 0) {
        const firstError = Object.values(notCreated)[0] as JMAPSetError;
        throw new Error(firstError?.description || firstError?.type || 'Import failed');
      }

      return importResult;
    },
    onSuccess: () => {
      invalidateEmailQueries(queryClient);
      toast.success('Message imported successfully');
    },
    onError: (err: Error) => {
      toast.error(`Import failed: ${err.message}`);
    },
    onSettled: () => {
      // Clear notification suppressor when mutation completes (success or error)
      // This ensures notifications work correctly after import finishes
      sharedNotificationSuppressor.suppress();
    },
  });
}
