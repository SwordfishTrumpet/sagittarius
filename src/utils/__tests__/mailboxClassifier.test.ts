import { describe, it, expect } from 'vitest';
import type { Mailbox } from '../../types/jmap';
import {
  classifyMailboxes,
  isSystemMailbox,
  isCustomFolder,
} from '../mailboxClassifier';

describe('mailboxClassifier', () => {
  // Test data factory
  const createMailbox = (
    id: string,
    name: string,
    overrides: Partial<Mailbox> = {}
  ): Mailbox => ({
    id,
    name,
    role: overrides.role ?? null,
    parentId: overrides.parentId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    unreadEmails: overrides.unreadEmails ?? 0,
    totalEmails: overrides.totalEmails ?? 0,
    unreadThreads: overrides.unreadThreads ?? 0,
    totalThreads: overrides.totalThreads ?? 0,
    myRights: overrides.myRights || {
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
    isSubscribed: overrides.isSubscribed ?? true,
  });

  describe('classifyMailboxes', () => {
    it('should return empty arrays for empty input', () => {
      const result = classifyMailboxes([]);
      expect(result.system).toEqual([]);
      expect(result.custom).toEqual([]);
    });

    it('should classify mailboxes with system roles as system', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: 'inbox' }),
        createMailbox('2', 'Sent', { role: 'sent' }),
        createMailbox('3', 'Drafts', { role: 'drafts' }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(3);
      expect(result.custom).toHaveLength(0);
    });

    it('should classify mailboxes without roles as custom', () => {
      const mailboxes = [
        createMailbox('1', 'Work'),
        createMailbox('2', 'Personal'),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(0);
      expect(result.custom).toHaveLength(2);
    });

    it('should classify by well-known names for top-level mailboxes', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: null, parentId: null }),
        createMailbox('2', 'Drafts', { role: null, parentId: null }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(2);
      expect(result.custom).toHaveLength(0);
    });

    it('should not classify by well-known names for subfolders', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: 'inbox' }),
        createMailbox('2', 'Inbox', { role: null, parentId: '1' }), // Subfolder named "Inbox"
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(1);
      expect(result.custom).toHaveLength(1);
    });

    it('should sort system mailboxes in canonical order', () => {
      const mailboxes = [
        createMailbox('1', 'Trash', { role: 'trash' }),
        createMailbox('2', 'Drafts', { role: 'drafts' }),
        createMailbox('3', 'Sent', { role: 'sent' }),
        createMailbox('4', 'Inbox', { role: 'inbox' }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system[0].name).toBe('Inbox');
      expect(result.system[1].name).toBe('Drafts');
      expect(result.system[2].name).toBe('Sent');
      expect(result.system[3].name).toBe('Trash');
    });

    it('should handle case-insensitive name matching', () => {
      const mailboxes = [
        createMailbox('1', 'INBOX', { role: null }),
        createMailbox('2', 'Sent Items', { role: null }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(2);
    });

    it('should handle mixed system and custom mailboxes', () => {
      const mailboxes = [
        createMailbox('1', 'Inbox', { role: 'inbox' }),
        createMailbox('2', 'Work'),
        createMailbox('3', 'Sent', { role: 'sent' }),
        createMailbox('4', 'Personal'),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(2);
      expect(result.custom).toHaveLength(2);
    });

    it('should preserve unknown roles but treat as custom', () => {
      const mailboxes = [
        createMailbox('1', 'Custom', { role: 'custom' as Mailbox['role'] }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(0);
      expect(result.custom).toHaveLength(1);
    });

    it('should handle spam as junk alias', () => {
      const mailboxes = [
        createMailbox('1', 'Spam', { role: 'spam' }),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.system).toHaveLength(1);
    });

    it('should not modify custom mailboxes order', () => {
      const mailboxes = [
        createMailbox('1', 'Zebra'),
        createMailbox('2', 'Alpha'),
      ];
      const result = classifyMailboxes(mailboxes);
      expect(result.custom[0].name).toBe('Zebra');
      expect(result.custom[1].name).toBe('Alpha');
    });
  });

  describe('isSystemMailbox', () => {
    it('should return true for mailbox with system role', () => {
      const mailbox = createMailbox('1', 'Inbox', { role: 'inbox' });
      expect(isSystemMailbox(mailbox)).toBe(true);
    });

    it('should return true for well-known system name', () => {
      const mailbox = createMailbox('1', 'Sent', { role: null });
      expect(isSystemMailbox(mailbox)).toBe(true);
    });

    it('should return false for custom folder', () => {
      const mailbox = createMailbox('1', 'Work');
      expect(isSystemMailbox(mailbox)).toBe(false);
    });

    it('should return false for subfolder with system name', () => {
      const mailbox = createMailbox('1', 'Inbox', { role: null, parentId: 'parent' });
      expect(isSystemMailbox(mailbox)).toBe(false);
    });
  });

  describe('isCustomFolder', () => {
    it('should return false for system mailbox', () => {
      const mailbox = createMailbox('1', 'Inbox', { role: 'inbox' });
      expect(isCustomFolder(mailbox)).toBe(false);
    });

    it('should return true for custom folder', () => {
      const mailbox = createMailbox('1', 'Work');
      expect(isCustomFolder(mailbox)).toBe(true);
    });

    it('should return true for folder with unknown role', () => {
      const mailbox = createMailbox('1', 'Custom', { role: 'custom' as Mailbox['role'] });
      expect(isCustomFolder(mailbox)).toBe(true);
    });
  });
});
