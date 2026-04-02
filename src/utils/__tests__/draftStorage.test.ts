import { beforeEach, describe, expect, it } from 'vitest';
import { clearComposerDraft, getComposerDraftKey, loadComposerDraft, saveComposerDraft } from '../draftStorage';

describe('composer draft storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds distinct keys per account and reply context', () => {
    expect(getComposerDraftKey('account-1')).toBe('sagittarius_composer_draft:account-1:new');
    expect(getComposerDraftKey('account-1', { id: 'message-1' })).toBe('sagittarius_composer_draft:account-1:reply:message-1');
    expect(getComposerDraftKey('account-1', { id: 'message-1', _replyAll: true })).toBe('sagittarius_composer_draft:account-1:reply-all:message-1');
    expect(getComposerDraftKey('account-1', { id: 'message-1', _forward: true })).toBe('sagittarius_composer_draft:account-1:forward:message-1');
    expect(getComposerDraftKey('account-1', { id: 'message-1', _draft: true })).toBe('sagittarius_composer_draft:account-1:draft:message-1');
  });

  it('round-trips saved drafts', () => {
    const key = getComposerDraftKey('account-1');
    const draft = {
      to: 'friend@example.com',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
      subject: 'Saved subject',
      body: '<p>Saved body</p>',
      attachments: [{ blobId: 'blob-1', name: 'agenda.pdf', type: 'application/pdf', size: 1024 }],
      selectedIdentityId: 'identity-1',
      showCcBcc: true,
      sendAt: '2026-03-31T12:00:00.000Z',
      isQuoteCollapsed: true,
    };

    saveComposerDraft(key, draft);
    expect(loadComposerDraft(key)).toEqual(draft);

    clearComposerDraft(key);
    expect(loadComposerDraft(key)).toBeNull();
  });

  it('normalizes partially invalid draft fields', () => {
    const key = getComposerDraftKey('account-1');
    localStorage.setItem(key, JSON.stringify({
      to: 'friend@example.com',
      attachments: [
        { blobId: 'blob-1', name: 'agenda.pdf', type: 'application/pdf', size: 1024 },
        { blobId: 1, name: 'broken attachment' },
      ],
      sendAt: 123,
    }));

    expect(loadComposerDraft(key)).toMatchObject({
      to: 'friend@example.com',
      sendAt: null,
      attachments: [{ blobId: 'blob-1', name: 'agenda.pdf', type: 'application/pdf', size: 1024 }],
    });
  });
});
