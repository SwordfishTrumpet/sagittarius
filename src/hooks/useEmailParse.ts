import { useQuery } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

const EMAIL_PARSE_PROPERTIES = [
  'id',
  'blobId',
  'threadId',
  'mailboxIds',
  'from',
  'to',
  'cc',
  'bcc',
  'replyTo',
  'subject',
  'receivedAt',
  'bodyValues',
  'textBody',
  'htmlBody',
  'attachments',
  'hasAttachment',
  'headers',
  'preview',
  'keywords',
] as const;

/**
 * useEmailParse — parses a raw email blob via Email/parse.
 * Enabled only when a blobId is provided.
 */
export function useEmailParse(blobId?: string) {
  const accountId = jmapClient.getPrimaryAccount();

  return useQuery({
    queryKey: ['emailParse', accountId, blobId],
    queryFn: async () => {
      const response = await jmapClient.request([
        [
          'Email/parse',
          {
            accountId,
            blobIds: [blobId!],
            properties: [...EMAIL_PARSE_PROPERTIES],
            fetchAllBodyValues: true,
          },
          '0',
        ],
      ]);

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        throw new Error(methodRes?.[1]?.description || 'Parse failed');
      }

      const parsed = methodRes[1]?.parsed ?? {};
      const notParsable = methodRes[1]?.notParsable ?? [];

      if (notParsable.includes(blobId)) {
        throw new Error('This blob could not be parsed as an email.');
      }

      return parsed[blobId!] ?? null;
    },
    enabled: !!accountId && !!blobId,
    staleTime: 10 * 60 * 1000,
  });
}
