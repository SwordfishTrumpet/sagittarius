import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCoreCapabilityLimits,
  getMailCapabilityLimits,
  getSieveCapabilityLimits,
  getCalendarCapabilityLimits,
  getBlobCapabilityLimits,
  getContactsCapabilityLimits,
  chunkForGet,
  chunkForSet,
  canCreateTopLevelMailbox,
  canCreateMailboxAtDepth,
  validateMailboxName,
  canCreateSieveScript,
  validateSieveScriptSize,
  validateAttachmentSize,
  canCreateCalendar,
  canAddParticipants,
  canCreateAddressBook,
  shouldChunkFileUpload,
  validateBlobDataSources,
} from '../capabilityUtils';
import { jmapClient } from '../../api/jmap';

// Mock the jmapClient
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getCapabilityConfig: vi.fn(),
    getAccountCapability: vi.fn(),
  },
}));

describe('capabilityUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCoreCapabilityLimits', () => {
    it('returns default limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue(null);

      const limits = getCoreCapabilityLimits();

      expect(limits.maxSizeUpload).toBe(50_000_000);
      expect(limits.maxConcurrentUpload).toBe(4);
      expect(limits.maxConcurrentRequests).toBe(4);
      expect(limits.maxCallsInRequest).toBe(16);
      expect(limits.maxObjectsInGet).toBe(500);
      expect(limits.maxObjectsInSet).toBe(500);
    });

    it('returns server-provided limits when available', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxSizeUpload: 100_000_000,
        maxConcurrentUpload: 8,
        maxConcurrentRequests: 8,
        maxCallsInRequest: 32,
        maxObjectsInGet: 1000,
        maxObjectsInSet: 1000,
      });

      const limits = getCoreCapabilityLimits();

      expect(limits.maxSizeUpload).toBe(100_000_000);
      expect(limits.maxConcurrentUpload).toBe(8);
      expect(limits.maxConcurrentRequests).toBe(8);
      expect(limits.maxCallsInRequest).toBe(32);
      expect(limits.maxObjectsInGet).toBe(1000);
      expect(limits.maxObjectsInSet).toBe(1000);
    });

    it('falls back to defaults for missing properties', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxSizeUpload: 75_000_000,
        // Other properties missing
      });

      const limits = getCoreCapabilityLimits();

      expect(limits.maxSizeUpload).toBe(75_000_000);
      expect(limits.maxConcurrentUpload).toBe(4); // default
      expect(limits.maxObjectsInSet).toBe(500); // default
    });
  });

  describe('getMailCapabilityLimits', () => {
    it('returns default mail limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const limits = getMailCapabilityLimits();

      expect(limits.maxSizeAttachmentsPerEmail).toBe(50_000_000);
      expect(limits.mayCreateTopLevelMailbox).toBe(true);
      expect(limits.maxMailboxDepth).toBeNull();
      expect(limits.maxMailboxesPerEmail).toBeNull();
      expect(limits.maxSizeMailboxName).toBe(255);
      expect(limits.emailQuerySortOptions).toContain('receivedAt');
    });

    it('returns server-provided mail limits when available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 25_000_000,
        mayCreateTopLevelMailbox: false,
        maxMailboxDepth: 10,
        maxMailboxesPerEmail: 20,
        maxSizeMailboxName: 100,
        emailQuerySortOptions: ['receivedAt', 'subject'],
      });

      const limits = getMailCapabilityLimits();

      expect(limits.maxSizeAttachmentsPerEmail).toBe(25_000_000);
      expect(limits.mayCreateTopLevelMailbox).toBe(false);
      expect(limits.maxMailboxDepth).toBe(10);
      expect(limits.maxMailboxesPerEmail).toBe(20);
      expect(limits.maxSizeMailboxName).toBe(100);
      expect(limits.emailQuerySortOptions).toEqual(['receivedAt', 'subject']);
    });
  });

  describe('getSieveCapabilityLimits', () => {
    it('returns default sieve limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const limits = getSieveCapabilityLimits();

      expect(limits.maxNumberScripts).toBe(100);
      expect(limits.maxSizeScript).toBe(1_048_576);
    });

    it('returns server-provided sieve limits when available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxNumberScripts: 50,
        maxSizeScript: 524_288,
      });

      const limits = getSieveCapabilityLimits();

      expect(limits.maxNumberScripts).toBe(50);
      expect(limits.maxSizeScript).toBe(524_288);
    });
  });

  describe('getCalendarCapabilityLimits', () => {
    it('returns default calendar limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const limits = getCalendarCapabilityLimits();

      expect(limits.maxParticipantsPerEvent).toBeNull();
      expect(limits.maxCalendarsPerEvent).toBeNull();
      expect(limits.mayCreateCalendar).toBe(true);
    });

    it('returns server-provided calendar limits when available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: 50,
        maxCalendarsPerEvent: 10,
        mayCreateCalendar: false,
      });

      const limits = getCalendarCapabilityLimits();

      expect(limits.maxParticipantsPerEvent).toBe(50);
      expect(limits.maxCalendarsPerEvent).toBe(10);
      expect(limits.mayCreateCalendar).toBe(false);
    });
  });

  describe('getBlobCapabilityLimits', () => {
    it('returns default blob limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const limits = getBlobCapabilityLimits();

      expect(limits.maxSizeBlobSet).toBe(7_500_000);
      expect(limits.maxDataSources).toBe(16);
    });

    it('returns server-provided blob limits when available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeBlobSet: 15_000_000,
        maxDataSources: 32,
      });

      const limits = getBlobCapabilityLimits();

      expect(limits.maxSizeBlobSet).toBe(15_000_000);
      expect(limits.maxDataSources).toBe(32);
    });
  });

  describe('getContactsCapabilityLimits', () => {
    it('returns default contacts limits when no capabilities are available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const limits = getContactsCapabilityLimits();

      expect(limits.mayCreateAddressBook).toBe(true);
    });

    it('returns server-provided contacts limits when available', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateAddressBook: false,
      });

      const limits = getContactsCapabilityLimits();

      expect(limits.mayCreateAddressBook).toBe(false);
    });
  });

  describe('chunkForGet', () => {
    it('chunks items according to maxObjectsInGet', () => {
      const items = Array.from({ length: 1200 }, (_, i) => `item-${i}`);
      const chunks = chunkForGet(items, 500);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(500);
      expect(chunks[2]).toHaveLength(200);
    });

    it('returns single chunk when items fit within limit', () => {
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const chunks = chunkForGet(items, 500);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(100);
    });

    it('uses default limit when not specified', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue(null);
      const items = Array.from({ length: 600 }, (_, i) => `item-${i}`);
      const chunks = chunkForGet(items);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(100);
    });
  });

  describe('chunkForSet', () => {
    it('chunks items according to maxObjectsInSet', () => {
      const items = Array.from({ length: 1200 }, (_, i) => `item-${i}`);
      const chunks = chunkForSet(items, 500);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(500);
      expect(chunks[2]).toHaveLength(200);
    });

    it('returns single chunk when items fit within limit', () => {
      const items = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      const chunks = chunkForSet(items, 500);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(100);
    });

    it('uses default limit when not specified', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue(null);
      const items = Array.from({ length: 600 }, (_, i) => `item-${i}`);
      const chunks = chunkForSet(items);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(500);
      expect(chunks[1]).toHaveLength(100);
    });
  });

  describe('canCreateTopLevelMailbox', () => {
    it('returns true when mayCreateTopLevelMailbox is true', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateTopLevelMailbox: true,
      });

      expect(canCreateTopLevelMailbox()).toBe(true);
    });

    it('returns false when mayCreateTopLevelMailbox is false', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateTopLevelMailbox: false,
      });

      expect(canCreateTopLevelMailbox()).toBe(false);
    });
  });

  describe('canCreateMailboxAtDepth', () => {
    it('returns true when no depth limit is set', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxMailboxDepth: null,
      });

      expect(canCreateMailboxAtDepth(100)).toBe(true);
    });

    it('returns true when current depth is below limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxMailboxDepth: 10,
      });

      expect(canCreateMailboxAtDepth(5)).toBe(true);
      expect(canCreateMailboxAtDepth(9)).toBe(true);
    });

    it('returns false when at or beyond depth limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxMailboxDepth: 10,
      });

      expect(canCreateMailboxAtDepth(10)).toBe(false);
      expect(canCreateMailboxAtDepth(11)).toBe(false);
    });
  });

  describe('validateMailboxName', () => {
    it('validates non-empty names', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeMailboxName: 255,
      });

      expect(validateMailboxName('Inbox')).toEqual({ isValid: true });
    });

    it('rejects empty names', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeMailboxName: 255,
      });

      expect(validateMailboxName('')).toEqual({
        isValid: false,
        error: 'Mailbox name is required',
      });
    });

    it('rejects whitespace-only names', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeMailboxName: 255,
      });

      expect(validateMailboxName('   ')).toEqual({
        isValid: false,
        error: 'Mailbox name is required',
      });
    });

    it('rejects names exceeding byte limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeMailboxName: 10,
      });

      const longName = 'a'.repeat(20);
      const result = validateMailboxName(longName);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('canCreateSieveScript', () => {
    it('returns true when below script limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxNumberScripts: 100,
      });

      expect(canCreateSieveScript(50)).toBe(true);
      expect(canCreateSieveScript(99)).toBe(true);
    });

    it('returns false when at script limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxNumberScripts: 100,
      });

      expect(canCreateSieveScript(100)).toBe(false);
      expect(canCreateSieveScript(101)).toBe(false);
    });
  });

  describe('validateSieveScriptSize', () => {
    it('validates scripts within size limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeScript: 1024,
      });

      expect(validateSieveScriptSize('small script')).toEqual({ isValid: true });
    });

    it('rejects scripts exceeding size limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeScript: 1024,
      });

      const largeScript = 'x'.repeat(2000);
      const result = validateSieveScriptSize(largeScript);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('validateAttachmentSize', () => {
    it('validates when total size is within limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 50_000_000,
      });

      const attachments = [
        { size: 10_000_000 },
        { size: 15_000_000 },
      ];
      const result = validateAttachmentSize(attachments);

      expect(result.isValid).toBe(true);
      expect(result.totalSize).toBe(25_000_000);
    });

    it('rejects when total size exceeds limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 20_000_000,
      });

      const attachments = [
        { size: 15_000_000 },
        { size: 15_000_000 },
      ];
      const result = validateAttachmentSize(attachments);

      expect(result.isValid).toBe(false);
      expect(result.totalSize).toBe(30_000_000);
      expect(result.error).toContain('exceeds');
    });

    it('handles empty attachments', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 50_000_000,
      });

      const result = validateAttachmentSize([]);

      expect(result.isValid).toBe(true);
      expect(result.totalSize).toBe(0);
    });
  });

  describe('canCreateCalendar', () => {
    it('returns true when mayCreateCalendar is true', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateCalendar: true,
      });

      expect(canCreateCalendar()).toBe(true);
    });

    it('returns false when mayCreateCalendar is false', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateCalendar: false,
      });

      expect(canCreateCalendar()).toBe(false);
    });
  });

  describe('canAddParticipants', () => {
    it('returns true when no participant limit is set', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: null,
      });

      expect(canAddParticipants(1000)).toBe(true);
    });

    it('returns true when participant count is within limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: 50,
      });

      expect(canAddParticipants(25)).toBe(true);
      expect(canAddParticipants(50)).toBe(true);
    });

    it('returns false when participant count exceeds limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: 50,
      });

      expect(canAddParticipants(51)).toBe(false);
    });
  });

  describe('canCreateAddressBook', () => {
    it('returns true when mayCreateAddressBook is true', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateAddressBook: true,
      });

      expect(canCreateAddressBook()).toBe(true);
    });

    it('returns false when mayCreateAddressBook is false', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateAddressBook: false,
      });

      expect(canCreateAddressBook()).toBe(false);
    });
  });

  describe('shouldChunkFileUpload', () => {
    it('returns false when file is smaller than limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeBlobSet: 7_500_000,
      });

      expect(shouldChunkFileUpload(5_000_000)).toBe(false);
    });

    it('returns true when file exceeds limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeBlobSet: 7_500_000,
      });

      expect(shouldChunkFileUpload(10_000_000)).toBe(true);
    });

    it('returns false when file exactly at limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeBlobSet: 7_500_000,
      });

      expect(shouldChunkFileUpload(7_500_000)).toBe(false);
    });
  });

  describe('validateBlobDataSources', () => {
    it('validates when count is within limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxDataSources: 16,
      });

      expect(validateBlobDataSources(10)).toEqual({ isValid: true });
      expect(validateBlobDataSources(16)).toEqual({ isValid: true });
    });

    it('rejects when count exceeds limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxDataSources: 16,
      });

      const result = validateBlobDataSources(20);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Too many data sources');
    });
  });
});
