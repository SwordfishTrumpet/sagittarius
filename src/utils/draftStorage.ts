import { logger } from './logger';

export interface ComposerDraftAttachment {
  blobId: string;
  name: string;
  type: string;
  size: number;
}

export interface ComposerDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: ComposerDraftAttachment[];
  selectedIdentityId: string | null;
  showCcBcc: boolean;
  sendAt: string | null;
  isQuoteCollapsed: boolean;
}

const STORAGE_PREFIX = 'sagittarius_composer_draft';

function normalizeReplyContext(replyTo?: any): string {
  if (!replyTo) return 'new';

  const suffix = replyTo.id || replyTo.threadId || 'message';
  if (replyTo._forward) return `forward:${suffix}`;
  if (replyTo._replyAll) return `reply-all:${suffix}`;
  return `reply:${suffix}`;
}

export function getComposerDraftKey(accountId: string | null | undefined, replyTo?: any): string {
  return `${STORAGE_PREFIX}:${accountId || 'default'}:${normalizeReplyContext(replyTo)}`;
}

function isAttachmentDraft(value: unknown): value is ComposerDraftAttachment {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.blobId === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.size === 'number';
}

export function loadComposerDraft(key: string): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      to: typeof parsed.to === 'string' ? parsed.to : '',
      cc: typeof parsed.cc === 'string' ? parsed.cc : '',
      bcc: typeof parsed.bcc === 'string' ? parsed.bcc : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      body: typeof parsed.body === 'string' ? parsed.body : '',
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments.filter(isAttachmentDraft)
        : [],
      selectedIdentityId: typeof parsed.selectedIdentityId === 'string' ? parsed.selectedIdentityId : null,
      showCcBcc: Boolean(parsed.showCcBcc),
      sendAt: typeof parsed.sendAt === 'string' ? parsed.sendAt : null,
      isQuoteCollapsed: Boolean(parsed.isQuoteCollapsed),
    };
  } catch {
    logger.warn('Failed to restore composer draft');
    return null;
  }
}

export function saveComposerDraft(key: string, draft: ComposerDraft): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    logger.warn('Failed to persist composer draft');
  }
}

export function clearComposerDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    logger.warn('Failed to clear composer draft');
  }
}
