import { useCallback, useMemo, useState } from 'react'
import { Mail, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import { blockExternalImages, resolveCidImages, isInlineAttachment } from '../utils/privacy'
import { jmapClient } from '../api/jmap'
import { ImageApprovalBanner } from './ImageApprovalBanner'
import { ReadReceiptBanner } from './ReadReceiptBanner'
import { DeliveryStatus } from './DeliveryStatus'
import { SmimeBadge } from './SmimeBadge'
import { AttachmentItem } from './AttachmentItem'
import { EmailBodyFrame } from './EmailBodyFrame'
import { useTheme } from '../hooks/useTheme'
import { logger } from '../utils/logger'
import { toastOperationError } from '../utils/toastHelpers'
import type { Email, Mailbox, Identity, EmailBodyPart } from '../types/jmap'

interface MutationWithMutate<TVariables, TOptions = Record<string, unknown>> {
  mutate: (variables: TVariables, options?: TOptions) => void;
}

/** Extended Email type with dynamic header properties and body values */
type EmailWithHeaders = Email & {
  'header:Disposition-Notification-To:asText'?: string;
  bodyValues?: Record<string, { value: string }>;
}

export interface EmailReaderProps {
  threadEmails: EmailWithHeaders[] | undefined
  emailLoading: boolean
  isEmailDetailError: boolean
  emailDetailError: Error | null
  selectedEmailId: string | null
  mailboxes: Mailbox[] | undefined
  primaryIdentity: Identity | undefined
  sendMDN: MutationWithMutate<{ emailId: string; identityId: string }, { onSuccess?: () => void; onError?: (err: Error) => void }>
  updateKeywords: MutationWithMutate<{ emailId: string; keywords: Record<string, boolean> }>
}

export function EmailReader({
  threadEmails,
  emailLoading,
  isEmailDetailError,
  emailDetailError,
  selectedEmailId,
  mailboxes,
  primaryIdentity,
  sendMDN,
  updateKeywords,
}: EmailReaderProps) {
  const { isDark } = useTheme()
  const [remoteImageState, setRemoteImageState] = useState<Record<string, { showRemoteImages?: boolean; bannerDismissed?: boolean }>>({})

  const formatReceivedAt = (value: string | undefined): string => {
    if (!value) return 'Unknown date'

    try {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return 'Unknown date'
      return format(date, 'MMMM d, yyyy · h:mm a')
    } catch {
      return 'Unknown date'
    }
  }

  const escapeHtml = (value: string): string => (
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

  const normalizeSagittariusQuoteSpacing = (html: string): string => {
    if (/data-sagittarius-quote=["']1["']/i.test(html)) {
      return html
        .replace(/(<br\s*\/?>\s*){2,}(?=\s*<div[^>]*data-sagittarius-quote=["']1["'])/gi, '')
        .replace(/(<b>Begin forwarded message:<\/b>)\s*(<br\s*\/?>\s*){2,}/gi, '$1<br/>')
    }

    return html
      .replace(
        /(<br\s*\/?>\s*){2,}(?=\s*<div id=["']quoted-content["']>\s*<div style=["'][^"']*font-size: 13px[^"']*["'])/gi,
        '',
      )
      .replace(
        /(<div id=["']quoted-content["']>\s*<div style=["'][^"']*font-size: 13px[^"']*border-top[^"']*["']>\s*<b>Begin forwarded message:<\/b>)\s*(<br\s*\/?>\s*){2,}/gi,
        '$1<br/>',
      )
  }

  const getProcessedHtml = useCallback((email: EmailWithHeaders): { blockedImageCount: number; displayHtml: string } | null => {
    if (!email) return null;
    try {
      const emailState = remoteImageState[email.id];

      let html = '';
      const isHtmlEmail = email.htmlBody && email.htmlBody.length > 0;
      if (isHtmlEmail && email.htmlBody) {
        const partId = email.htmlBody[0].partId;
        html = (partId && email.bodyValues?.[partId]?.value) || '';
      } else if (email.textBody && email.textBody.length > 0) {
        const partId = email.textBody[0].partId;
        html = `<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;">${escapeHtml((partId && email.bodyValues?.[partId]?.value) || '')}</pre>`;
      }

      // Handle empty body content as "no content"
      if (!html || html.trim().length === 0 || html === '<pre style="font-family: inherit; white-space: pre-wrap; margin: 0;"></pre>') {
        html = '<div style="padding:20px;color:var(--icloud-text-secondary);font-style:italic;">(No content)</div>';
      }

      // Sanitize with DOMPurify FIRST (security)
      let sanitized = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'data-blocked-src', 'data-blocked-srcset', 'data-cid-src', 'data-blocked-style', 'data-sagittarius-quote']
      });

      // Resolve CID inline images AFTER sanitization (VULN-002 fix: now uses safe DOM parsing)
      sanitized = resolveCidImages(sanitized, email, (blobId, type, name) =>
        jmapClient.getBlobUrl(blobId, type, name)
      );

      sanitized = normalizeSagittariusQuoteSpacing(sanitized)

      const blockedInfo = blockExternalImages(sanitized);

      return {
        blockedImageCount: blockedInfo.count,
        displayHtml: emailState?.showRemoteImages || blockedInfo.count === 0
          ? sanitized
          : blockedInfo.modifiedHtml,
      };
    } catch (err) {
      logger.error('Failed to sanitize email HTML:', err);
      return {
        blockedImageCount: 0,
        displayHtml: '<div style="padding:20px;color:var(--icloud-text-secondary);font-style:italic;">Unable to display this message.</div>',
      };
    }
  }, [remoteImageState]);

  const handleLoadRemoteImages = (emailId: string) => {
    logger.info('[EmailReader] Loading remote images for email:', { emailId })
    setRemoteImageState(prev => {
      const next = {
        ...prev,
        [emailId]: {
          ...prev[emailId],
          showRemoteImages: true,
          bannerDismissed: false,
        }
      };
      const keys = Object.keys(next);
      if (keys.length > 50) {
        keys.slice(0, keys.length - 50).forEach(k => delete next[k]);
      }
      return next;
    });
  };

  const processedEmails = useMemo(
    () => (threadEmails ?? []).map((email) => ({
      email,
      emailImageState: remoteImageState[email.id],
      processedHtml: getProcessedHtml(email),
    })),
    [threadEmails, remoteImageState, getProcessedHtml],
  )

  if (isEmailDetailError) {
    return (
      <article className="flex-1 overflow-y-auto bg-icloud-bg-layer2 select-text">
        <div className="flex flex-col items-center justify-center h-full text-center px-10" role="alert">
          <p className="text-lg font-medium text-icloud-red">Failed to load message</p>
          <p className="text-sm text-icloud-text-secondary mt-2 max-w-md">{emailDetailError?.message || 'An unexpected error occurred while loading the email.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-icloud-accent text-white rounded-lg text-sm font-medium hover:bg-icloud-accent-hover transition-colors"
          >
            Retry
          </button>
          <p className="text-xs text-icloud-text-tertiary mt-4">
            If the problem persists, check your connection or contact support.
          </p>
        </div>
      </article>
    );
  }

  if (emailLoading) {
    return (
      <article className="flex-1 overflow-y-auto bg-icloud-bg-layer2 select-text">
        <div className="flex items-center justify-center py-20 opacity-30 h-full" role="status" aria-live="polite">
          <div className="w-10 h-10 border-3 border-icloud-accent border-t-transparent rounded-full animate-spin" />
          <span className="sr-only">Loading email</span>
        </div>
      </article>
    );
  }

  if (!threadEmails || threadEmails.length === 0) {
    return (
      <article className="flex-1 overflow-y-auto bg-icloud-bg-layer2 select-text">
        <div className="flex flex-col items-center justify-center h-full text-icloud-text-secondary text-center opacity-30 px-10">
          <Mail className="w-20 h-20 mb-5 stroke-1" />
          <h2 className="text-xl font-medium tracking-tight">No Message Selected</h2>
        </div>
      </article>
    );
  }

  return (
    <article className="flex-1 overflow-y-auto bg-icloud-bg-layer2 select-text">
      <div className="w-full px-5 py-6 animate-in fade-in duration-300">
        {processedEmails.map(({ email, emailImageState, processedHtml }, index: number) => {
          const blockedImageCount = processedHtml?.blockedImageCount || 0;
          const isImageBannerDismissed = emailImageState?.showRemoteImages || emailImageState?.bannerDismissed || false;
          
          return (
            <div key={email.id} className={`${index > 0 ? 'pt-4 border-t border-icloud-bg-layer1' : ''}`}>
              <header className="mb-5 pb-3 border-b border-icloud-bg-layer1">
                <div className="flex items-start justify-between mb-5 gap-4">
                    <h1 className="text-[22px] font-bold text-icloud-text-primary leading-snug tracking-tight">{email.subject || '(No Subject)'}</h1>
                    <time className="text-[13px] text-icloud-text-secondary font-medium pt-1 shrink-0">
                      {formatReceivedAt(email.receivedAt)}
                    </time>
                </div>
                <div className="flex items-center gap-4">
                    <div role="img" aria-label={`Avatar for ${email.from?.[0]?.name || email.from?.[0]?.email || 'unknown sender'}`} className="w-11 h-11 rounded-full bg-icloud-accent shadow-sm flex items-center justify-center text-white font-bold text-[18px] shrink-0 uppercase">
                      {email.from?.[0]?.name?.charAt(0) || email.from?.[0]?.email?.charAt(0) || '?'}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="font-bold text-[15px] truncate text-icloud-text-primary">
                        {email.from?.[0]?.name || email.from?.[0]?.email} 
                        <span className="font-normal text-icloud-text-secondary ml-2 tracking-tight">
                          &lt;{email.from?.[0]?.email}&gt;
                        </span>
                      </div>
                      <div className="text-[13px] text-icloud-text-secondary truncate font-medium mt-0.5 flex items-center gap-2">
                        <span>To: {email.to?.map((t: { name?: string | null; email: string }) => t.name || t.email).join(', ')}</span>
                        {/* Delivery status for sent emails */}
                        {(() => {
                          const sentMailbox = mailboxes?.find((m) => m.role === 'sent' || (!m.role && ['sent', 'sent items', 'sent mail'].includes(m.name.toLowerCase())));
                          return sentMailbox && email.mailboxIds?.[sentMailbox.id] && (
                            <DeliveryStatus emailId={email.id} />
                          );
                        })()}
                        <SmimeBadge status={email.smimeStatus} certificate={email.smimeCertificate} />
                      </div>
                    </div>
                </div>
              </header>

              {/* External Image Blocking Banner */}
              {blockedImageCount > 0 && (
                <ImageApprovalBanner
                  blockedImageCount={blockedImageCount}
                  onLoadImages={() => handleLoadRemoteImages(email.id)}
                  isDismissed={isImageBannerDismissed}
                  onDismiss={() => {
                    setRemoteImageState(prev => ({
                      ...prev,
                      [email.id]: {
                        ...prev[email.id],
                        bannerDismissed: true
                      }
                    }));
                  }}
                />
              )}

              {/* Read Receipt Banner */}
              {email['header:Disposition-Notification-To:asText'] && !email.keywords?.['$mdnsent'] && (
                <ReadReceiptBanner
                  sender={email.from?.[0]?.name || email.from?.[0]?.email || 'Sender'}
                  onSendReceipt={() => {
                    if (primaryIdentity) {
                      sendMDN.mutate({
                        emailId: email.id,
                        identityId: primaryIdentity.id,
                      }, {
                        onSuccess: () => {
                          toast.success('Read receipt sent');
                          updateKeywords.mutate({ emailId: email.id, keywords: { '$mdnsent': true } });
                        },
                        onError: (err: Error) => toastOperationError('mdn.send', err),
                      });
                    }
                  }}
                  onIgnore={() => {
                    updateKeywords.mutate({ emailId: email.id, keywords: { '$mdnsent': true } });
                  }}
                />
              )}

              <div className="email-content select-text cursor-text">
                <EmailBodyFrame html={processedHtml?.displayHtml || ''} darkMode={isDark} />
              </div>

              {(() => {
                const visibleAttachments = (email.attachments?.filter((a) => !isInlineAttachment(a)) || []) as EmailBodyPart[];
                return visibleAttachments.length > 0 && (
                 <div className="mt-8 pt-6 border-t border-icloud-bg-layer1">
                  <div className="flex items-center gap-2 mb-6 text-icloud-text-secondary font-bold text-[11px] uppercase tracking-wider">
                    <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
                    {visibleAttachments.length} {visibleAttachments.length === 1 ? 'Attachment' : 'Attachments'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleAttachments.map((attachment) => (
                      <AttachmentItem key={attachment.blobId} attachment={attachment} />
                    ))}
                  </div>
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </article>
  );
}
