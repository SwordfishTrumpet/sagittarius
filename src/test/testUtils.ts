/**
 * Shared test utilities for creating properly typed mock objects
 */
import type { Email, Mailbox } from '../types/jmap';

/**
 * Create a test Email with minimal required fields.
 * All required fields have sensible defaults that can be overridden.
 */
export function createTestEmail(overrides: Partial<Email> & { id: string }): Email {
  return {
    blobId: `blob-${overrides.id}`,
    threadId: `thread-${overrides.id}`,
    mailboxIds: { inbox: true },
    keywords: {},
    size: 1000,
    receivedAt: new Date().toISOString(),
    hasAttachment: false,
    preview: 'Test preview',
    subject: 'Test Subject',
    from: [{ name: 'Sender', email: 'sender@example.com' }],
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    cc: null,
    bcc: null,
    replyTo: null,
    ...overrides,
  };
}

/**
 * Create a test Mailbox with minimal required fields.
 * All required fields have sensible defaults that can be overridden.
 */
export function createTestMailbox(overrides: Partial<Mailbox> & { id: string; name: string }): Mailbox {
  return {
    parentId: null,
    role: null,
    sortOrder: 0,
    totalEmails: 0,
    unreadEmails: 0,
    totalThreads: 0,
    unreadThreads: 0,
    isSubscribed: true,
    myRights: {
      mayReadItems: true,
      mayAddItems: true,
      mayRemoveItems: true,
      maySetSeen: true,
      maySetKeywords: true,
      mayCreateChild: true,
      mayRename: true,
      mayDelete: true,
      maySubmit: true,
    },
    ...overrides,
  };
}
