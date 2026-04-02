import { useQuery } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';
import type { Email } from '../types/jmap';

/** Email/parse response structure */
interface EmailParseResponse {
  accountId: string;
  parsed?: Record<string, Email>;
  notParsable?: string[];
}

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
        const errorResult = methodRes?.[1] as { description?: string } | undefined;
        throw new Error(errorResult?.description || 'Parse failed');
      }

      const parseResult = methodRes[1] as EmailParseResponse;
      const parsed = parseResult?.parsed ?? {};
      const notParsable = parseResult?.notParsable ?? [];

      if (blobId && notParsable.includes(blobId)) {
        throw new Error('This blob could not be parsed as an email.');
      }

      return blobId ? (parsed[blobId] ?? null) : null;
    },
    enabled: !!accountId && !!blobId,
    staleTime: 10 * 60 * 1000,
  });
}
