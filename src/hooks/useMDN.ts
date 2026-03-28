import { useMutation } from '@tanstack/react-query';
import { jmapClient } from '../api/jmap';

const MDN_CAP = 'urn:ietf:params:jmap:mdn';

export interface SendMDNParams {
  emailId: string;
  identityId: string;
  subject?: string;
  textBody?: string;
}

/**
 * useSendMDN — sends a Message Disposition Notification per RFC 9007.
 */
export function useSendMDN() {
  const accountId = jmapClient.getPrimaryAccount();

  return useMutation({
    mutationFn: async ({
      emailId,
      identityId,
      subject,
      textBody,
    }: SendMDNParams) => {
      const mdnObject: Record<string, any> = {
        emailId,
        identityId,
        disposition: {
          actionMode: 'manual-action',
          sendingMode: 'MDN-sent-manually',
          type: 'displayed',
        },
      };

      if (subject) mdnObject.subject = subject;
      if (textBody) mdnObject.textBody = textBody;

      const response = await jmapClient.request(
        [
          [
            'MDN/send',
            {
              accountId,
              send: {
                'mdn-1': mdnObject,
              },
            },
            '0',
          ],
        ],
        [MDN_CAP],
      );

      const methodRes = response.methodResponses[0];
      if (!methodRes || methodRes[0] === 'error') {
        throw new Error(methodRes?.[1]?.description || 'Failed to send read receipt');
      }

      const notSent = methodRes[1]?.notSent;
      if (notSent && Object.keys(notSent).length > 0) {
        const firstError = Object.values(notSent)[0] as any;
        throw new Error(firstError?.description || firstError?.type || 'Failed to send read receipt');
      }

      return methodRes[1];
    },
  });
}
