import { useState, useEffect, useRef } from 'react'
import { Mail, Paperclip } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import DOMPurify from 'dompurify'
import { blockExternalImages, resolveCidImages, isInlineAttachment, type BlockedImageInfo } from '../utils/privacy'
import { jmapClient } from '../api/jmap'
import { ImageApprovalBanner } from './ImageApprovalBanner'
import { ReadReceiptBanner } from './ReadReceiptBanner'
import { DeliveryStatus } from './DeliveryStatus'
import { AttachmentItem } from './AttachmentItem'
import { logger } from '../utils/logger'

export interface EmailReaderProps {
  threadEmails: any[] | undefined
  emailLoading: boolean
  isEmailDetailError: boolean
  emailDetailError: Error | null
  selectedEmailId: string | null
  mailboxes: any[] | undefined
  primaryIdentity: any
  sendMDN: any
  updateKeywords: any
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
  // Remote image blocking state: Map of emailId -> { showRemoteImages, bannerDismissed, blockedImageInfo }
  const [remoteImageState, setRemoteImageState] = useState<Record<string, { showRemoteImages: boolean; bannerDismissed?: boolean; blockedImageInfo?: BlockedImageInfo }>>({})
  
  // Ref for the email reader container — used to resolve CID inline images after render
  const emailReaderRef = useRef<HTMLDivElement>(null);

  const sanitizedHtml = (email: any): string | null => {
    if (!email) return null;
    try {
      const emailState = remoteImageState[email.id];
      
      // If images were previously blocked and user approved them,
      // return the cached original (pre-blocked) sanitized HTML directly.
      if (emailState?.showRemoteImages && emailState?.blockedImageInfo?.originalHtml) {
        return emailState.blockedImageInfo.originalHtml;
      }

      let html = '';
      if (email.htmlBody && email.htmlBody.length > 0) {
        const partId = email.htmlBody[0].partId;
        html = email.bodyValues?.[partId]?.value || '';
      } else if (email.textBody && email.textBody.length > 0) {
        const partId = email.textBody[0].partId;
        html = `<pre style="font-family: inherit; white-space: pre-wrap;">${email.bodyValues?.[partId]?.value || ''}</pre>`;
      }

      // Resolve CID inline images BEFORE DOMPurify (DOMPurify strips cid: protocol)
      html = resolveCidImages(html, email, (blobId, type, name) =>
        jmapClient.getBlobUrl(blobId, type, name)
      );

      // Sanitize with DOMPurify — allow data-cid-src for post-render auth fetch
      let sanitized = DOMPurify.sanitize(html, {
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['target', 'data-blocked-src', 'data-cid-src']
      });

      // Block external images — email hasn't been approved yet
      const blockedInfo = blockExternalImages(sanitized);
      
      // Store the blocked image info for the banner (bounded cache — max 50)
      if (blockedInfo.count > 0 && !emailState) {
        setRemoteImageState(prev => {
          if (prev[email.id]) return prev;
          const next: Record<string, { showRemoteImages: boolean; bannerDismissed?: boolean; blockedImageInfo?: BlockedImageInfo }> = {
            ...prev,
            [email.id]: {
              showRemoteImages: false,
              blockedImageInfo: blockedInfo
            }
          };
          const keys = Object.keys(next);
          if (keys.length > 50) {
            keys.slice(0, keys.length - 50).forEach(k => delete next[k]);
          }
          return next;
        });
      }
      
      return blockedInfo.count > 0 ? blockedInfo.modifiedHtml : sanitized;
    } catch (err) {
      logger.error('Failed to sanitize email HTML:', err);
      return '<div style="padding:20px;color:#8E8E93;font-style:italic;">Unable to display this message.</div>';
    }
  };

  const handleLoadRemoteImages = (emailId: string) => {
    setRemoteImageState(prev => ({
      ...prev,
      [emailId]: {
        ...prev[emailId],
        showRemoteImages: true
      }
    }));
  };

  // Post-render effect: fetch CID inline images with auth headers and replace src with blob: URLs.
  useEffect(() => {
    const container = emailReaderRef.current;
    if (!container) return;

    const authHeader = jmapClient.getAuthHeader();
    if (!authHeader) return;

    const cidImages = container.querySelectorAll<HTMLImageElement>('img[data-cid-src]');
    if (cidImages.length === 0) return;

    let cancelled = false;
    const objectUrls: string[] = [];

    cidImages.forEach(img => {
      const downloadUrl = img.getAttribute('src');
      if (!downloadUrl || downloadUrl.startsWith('blob:')) return;

      img.style.opacity = '0.5';

      fetch(downloadUrl, {
        headers: { 'Authorization': authHeader },
      })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          objectUrls.push(blobUrl);
          img.src = blobUrl;
          img.style.opacity = '';
        })
        .catch(() => {
          if (cancelled) return;
          img.style.opacity = '';
        });
    });

    return () => {
      cancelled = true;
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [threadEmails, selectedEmailId, remoteImageState]);

  if (isEmailDetailError) {
    return (
      <article className="flex-1 overflow-y-auto bg-white select-text">
        <div className="flex flex-col items-center justify-center h-full text-center px-10">
          <p className="text-lg font-medium text-[#FF3B30]">Failed to load message</p>
          <p className="text-sm text-[#8E8E93] mt-2">{emailDetailError?.message}</p>
        </div>
      </article>
    );
  }

  if (emailLoading) {
    return (
      <article className="flex-1 overflow-y-auto bg-white select-text">
        <div className="flex items-center justify-center py-20 opacity-30 h-full">
          <div className="w-10 h-10 border-3 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        </div>
      </article>
    );
  }

  if (!threadEmails || threadEmails.length === 0) {
    return (
      <article className="flex-1 overflow-y-auto bg-white select-text">
        <div className="flex flex-col items-center justify-center h-full text-[#8E8E93] text-center opacity-30 px-10">
          <Mail className="w-20 h-20 mb-5 stroke-1" />
          <h3 className="text-xl font-medium tracking-tight">No Message Selected</h3>
        </div>
      </article>
    );
  }

  return (
    <article ref={emailReaderRef} className="flex-1 overflow-y-auto bg-white select-text">
      <div className="max-w-[850px] mx-auto w-full p-8 md:p-12 animate-in fade-in duration-300 space-y-12">
        {threadEmails.map((email: any, index: number) => {
          const emailImageState = remoteImageState[email.id];
          const blockedImageCount = emailImageState?.blockedImageInfo?.count || 0;
          const isImageBannerDismissed = emailImageState?.showRemoteImages || emailImageState?.bannerDismissed || false;
          
          return (
            <div key={email.id} className={`${index > 0 ? 'pt-12 border-t border-[#F2F2F7]' : ''}`}>
              <header className="mb-10 pb-6 border-b border-[#F2F2F7]">
                <div className="flex items-start justify-between mb-6 gap-4">
                    <h1 className="text-[22px] font-bold text-[#1C1C1E] leading-snug tracking-tight">{email.subject || '(No Subject)'}</h1>
                    <time className="text-[13px] text-[#8E8E93] font-medium pt-1 shrink-0">
                      {format(new Date(email.receivedAt), 'MMMM d, yyyy · h:mm a')}
                    </time>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-[#007AFF] shadow-sm flex items-center justify-center text-white font-bold text-[18px] shrink-0 uppercase">
                      {email.from?.[0]?.name?.charAt(0) || email.from?.[0]?.email?.charAt(0) || '?'}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="font-bold text-[15px] truncate text-[#1C1C1E]">
                        {email.from?.[0]?.name || email.from?.[0]?.email} 
                        <span className="font-normal text-[#8E8E93] ml-2 tracking-tight">
                          &lt;{email.from?.[0]?.email}&gt;
                        </span>
                      </div>
                      <div className="text-[13px] text-[#8E8E93] truncate font-medium mt-0.5 flex items-center gap-2">
                        <span>To: {email.to?.map((t: any) => t.name || t.email).join(', ')}</span>
                        {/* Delivery status for sent emails */}
                        {mailboxes?.find((m: any) => m.role === 'sent' || (!m.role && ['sent', 'sent items', 'sent mail'].includes(m.name.toLowerCase()))) && email.mailboxIds?.[mailboxes.find((m: any) => m.role === 'sent' || (!m.role && ['sent', 'sent items', 'sent mail'].includes(m.name.toLowerCase())))?.id] && (
                          <DeliveryStatus emailId={email.id} />
                        )}
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
                        onError: (err: any) => toast.error(`Failed to send receipt: ${err.message}`),
                      });
                    }
                  }}
                  onIgnore={() => {
                    updateKeywords.mutate({ emailId: email.id, keywords: { '$mdnsent': true } });
                  }}
                />
              )}

              <div
                key={`${email.id}-${emailImageState?.showRemoteImages ? 'img' : 'noimg'}`}
                className="email-content text-[15px] leading-relaxed text-[#1C1C1E] font-sans select-text cursor-text"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml(email) || '' }}
              />

              {(() => {
                const visibleAttachments = email.attachments?.filter((a: any) => !isInlineAttachment(a)) || [];
                return visibleAttachments.length > 0 && (
                <div className="mt-12 pt-10 border-t border-[#F2F2F7]">
                  <div className="flex items-center gap-2 mb-6 text-[#8E8E93] font-bold text-[11px] uppercase tracking-wider">
                    <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
                    {visibleAttachments.length} {visibleAttachments.length === 1 ? 'Attachment' : 'Attachments'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleAttachments.map((attachment: any) => (
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
