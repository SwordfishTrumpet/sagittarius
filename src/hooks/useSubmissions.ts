import { useQuery } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

export interface EmailSubmission {
  id: string;
  identityId: string;
  emailId: string;
  threadId: string;
  envelope: {
    mailFrom: { email: string; parameters?: any };
    rcptTo: { email: string; parameters?: any }[];
  } | null;
  sendAt: string;
  undoStatus: 'pending' | 'final' | 'canceled';
  deliveryStatus: Record<
    string,
    {
      smtpReply: string;
      delivered: 'queued' | 'yes' | 'no' | 'unknown';
      displayed: 'unknown' | 'yes';
    }
  > | null;
  dsnBlobIds: string[];
  mdnBlobIds: string[];
}

/**
 * useSubmissionStatus — queries EmailSubmission records for a specific emailId.
 * staleTime: 2 minutes to avoid over-polling.
 */
export function useSubmissionStatus(emailId?: string) {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery<EmailSubmission[]>({
    queryKey: ['submissions', accountId, emailId],
    queryFn: async () => {
      // Step 1: query for submission IDs matching this emailId
      const queryResponse = await jmapClient.request([
        [
          'EmailSubmission/query',
          {
            accountId,
            filter: { emailId },
          },
          '0',
        ],
      ]);

      const ids: string[] = queryResponse.methodResponses[0]?.[1]?.ids ?? [];
      if (ids.length === 0) return [];

      // Step 2: fetch the full submission objects
      const getResponse = await jmapClient.request([
        [
          'EmailSubmission/get',
          {
            accountId,
            ids,
          },
          '1',
        ],
      ]);

      return getResponse.methodResponses[0]?.[1]?.list ?? [];
    },
    enabled: !!accountId && !!emailId,
    staleTime: 2 * 60 * 1000,
  });
}
