import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jmapClient } from '../api/jmap';
import { eventSourceManager } from '../api/eventSource';
import { webSocketManager } from '../api/websocket';

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
      eventSourceManager.suppressNotification();
      webSocketManager.suppressNotification();
    },
    mutationFn: async ({ blobId, mailboxIds, keywords }: EmailImportParams) => {
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
        throw new Error(methodRes?.[1]?.description || 'Import failed');
      }

      const notCreated = methodRes[1]?.notCreated;
      if (notCreated && Object.keys(notCreated).length > 0) {
        const firstError = Object.values(notCreated)[0] as any;
        throw new Error(firstError?.description || firstError?.type || 'Import failed');
      }

      return methodRes[1];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      toast.success('Message imported successfully');
    },
    onError: (err: Error) => {
      toast.error(`Import failed: ${err.message}`);
    },
  });
}
