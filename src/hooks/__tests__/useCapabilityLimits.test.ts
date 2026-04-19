import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useCapabilityLimits,
  useEmailBatchingLimits,
  useAttachmentLimits,
  useMailboxCreationLimits,
  useSieveLimits,
  useCalendarLimits,
  useContactsLimits,
} from '../useCapabilityLimits';
import { jmapClient } from '../../api/jmap';

// Mock the jmapClient
vi.mock('../../api/jmap', () => ({
  jmapClient: {
    getCapabilityConfig: vi.fn(),
    getAccountCapability: vi.fn(),
  },
}));

// Wrapper for React Query hooks
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => children;
};

describe('useCapabilityLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCapabilityLimits hook', () => {
    it('returns core limits from capabilities', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxSizeUpload: 75_000_000,
        maxObjectsInSet: 250,
      });
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 25_000_000,
        mayCreateTopLevelMailbox: false,
      });

      const { result } = renderHook(() => useCapabilityLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.coreLimits.maxSizeUpload).toBe(75_000_000);
      expect(result.current.coreLimits.maxObjectsInSet).toBe(250);
      expect(result.current.mailLimits.maxSizeAttachmentsPerEmail).toBe(25_000_000);
      expect(result.current.mailLimits.mayCreateTopLevelMailbox).toBe(false);
    });

    it('provides chunking helpers', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxObjectsInSet: 100,
      });

      const { result } = renderHook(() => useCapabilityLimits(), {
        wrapper: createWrapper(),
      });

      const items = Array.from({ length: 250 }, (_, i) => i);
      const chunks = result.current.chunkIdsForSet(items);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(100);
      expect(chunks[1]).toHaveLength(100);
      expect(chunks[2]).toHaveLength(50);
    });

    it('provides validation helpers', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeMailboxName: 50,
        mayCreateTopLevelMailbox: true,
        maxMailboxDepth: 5,
      });

      const { result } = renderHook(() => useCapabilityLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreateRootMailbox()).toBe(true);
      expect(result.current.checkMailboxDepth(3)).toBe(true);
      expect(result.current.checkMailboxDepth(5)).toBe(false);

      const validation = result.current.checkMailboxName('Test Folder');
      expect(validation.isValid).toBe(true);
    });
  });

  describe('useEmailBatchingLimits', () => {
    it('returns max batch size from capabilities', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxObjectsInSet: 750,
      });

      const { result } = renderHook(() => useEmailBatchingLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.maxBatchSize).toBe(750);
    });

    it('chunks email IDs according to batch size', () => {
      vi.mocked(jmapClient.getCapabilityConfig).mockReturnValue({
        maxObjectsInSet: 100,
      });

      const { result } = renderHook(() => useEmailBatchingLimits(), {
        wrapper: createWrapper(),
      });

      const emailIds = Array.from({ length: 350 }, (_, i) => `email-${i}`);
      const chunks = result.current.chunkEmailIds(emailIds);

      expect(chunks).toHaveLength(4);
    });
  });

  describe('useAttachmentLimits', () => {
    it('returns attachment size limits', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 30_000_000,
      });

      const { result } = renderHook(() => useAttachmentLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.maxTotalSize).toBe(30_000_000);
      expect(result.current.maxTotalSizeMB).toBe(28); // 30MB in whole MB
    });

    it('validates attachments against limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 20_000_000,
      });

      const { result } = renderHook(() => useAttachmentLimits(), {
        wrapper: createWrapper(),
      });

      const validAttachments = [
        { size: 5_000_000 },
        { size: 10_000_000 },
      ];
      const validResult = result.current.validateAttachments(validAttachments);
      expect(validResult.isValid).toBe(true);

      const invalidAttachments = [
        { size: 15_000_000 },
        { size: 15_000_000 },
      ];
      const invalidResult = result.current.validateAttachments(invalidAttachments);
      expect(invalidResult.isValid).toBe(false);
    });

    it('checks if individual attachment can be added', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 20_000_000,
      });

      const { result } = renderHook(() => useAttachmentLimits(), {
        wrapper: createWrapper(),
      });

      const currentAttachments = [{ size: 10_000_000 }];

      expect(result.current.canAddAttachment(currentAttachments, 5_000_000)).toBe(true);
      expect(result.current.canAddAttachment(currentAttachments, 15_000_000)).toBe(false);
    });

    it('calculates remaining size budget', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeAttachmentsPerEmail: 20_000_000,
      });

      const { result } = renderHook(() => useAttachmentLimits(), {
        wrapper: createWrapper(),
      });

      const currentAttachments = [{ size: 8_000_000 }];

      expect(result.current.getRemainingSize(currentAttachments)).toBe(12_000_000);
    });
  });

  describe('useMailboxCreationLimits', () => {
    it('returns mailbox creation limits', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateTopLevelMailbox: false,
        maxMailboxDepth: 8,
        maxSizeMailboxName: 100,
      });

      const { result } = renderHook(() => useMailboxCreationLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreateTopLevel).toBe(false);
      expect(result.current.maxDepth).toBe(8);
      expect(result.current.maxNameLength).toBe(100);
    });

    it('provides depth status messages', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxMailboxDepth: 5,
      });

      const { result } = renderHook(() => useMailboxCreationLimits(), {
        wrapper: createWrapper(),
      });

      const status1 = result.current.getDepthStatus(3);
      expect(status1.canCreate).toBe(true);
      expect(status1.message).toBe('2 levels remaining');

      const status2 = result.current.getDepthStatus(4);
      expect(status2.canCreate).toBe(true);
      expect(status2.message).toBe('1 level remaining');

      const status3 = result.current.getDepthStatus(5);
      expect(status3.canCreate).toBe(false);
      expect(status3.message).toBe('Maximum folder depth reached (5 levels)');
    });

    it('handles unlimited depth', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxMailboxDepth: null,
      });

      const { result } = renderHook(() => useMailboxCreationLimits(), {
        wrapper: createWrapper(),
      });

      const status = result.current.getDepthStatus(100);
      expect(status.canCreate).toBe(true);
      expect(status.message).toBeUndefined();
    });
  });

  describe('useSieveLimits', () => {
    it('returns sieve limits', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxNumberScripts: 50,
        maxSizeScript: 524_288,
      });

      const { result } = renderHook(() => useSieveLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.maxScripts).toBe(50);
      expect(result.current.maxScriptSize).toBe(524_288);
      expect(result.current.maxScriptSizeKB).toBe(512);
    });

    it('checks if script can be created', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxNumberScripts: 10,
      });

      const { result } = renderHook(() => useSieveLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreateScript(5)).toBe(true);
      expect(result.current.canCreateScript(10)).toBe(false);
      expect(result.current.canCreateScript(15)).toBe(false);
    });

    it('validates script size', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxSizeScript: 1024,
      });

      const { result } = renderHook(() => useSieveLimits(), {
        wrapper: createWrapper(),
      });

      const smallScript = 'small';
      expect(result.current.validateScript(smallScript).isValid).toBe(true);

      const largeScript = 'x'.repeat(2000);
      const validation = result.current.validateScript(largeScript);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('too large');
    });
  });

  describe('useCalendarLimits', () => {
    it('returns calendar limits', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateCalendar: false,
        maxParticipantsPerEvent: 30,
      });

      const { result } = renderHook(() => useCalendarLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreate).toBe(false);
      expect(result.current.maxParticipants).toBe(30);
    });

    it('checks participant limit', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: 50,
      });

      const { result } = renderHook(() => useCalendarLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canAddMoreParticipants(25)).toBe(true);
      expect(result.current.canAddMoreParticipants(50)).toBe(true);
      expect(result.current.canAddMoreParticipants(51)).toBe(false);
    });

    it('handles unlimited participants', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        maxParticipantsPerEvent: null,
      });

      const { result } = renderHook(() => useCalendarLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canAddMoreParticipants(1000)).toBe(true);
    });
  });

  describe('useContactsLimits', () => {
    it('returns address book creation capability', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue({
        mayCreateAddressBook: false,
      });

      const { result } = renderHook(() => useContactsLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreateAddressBook()).toBe(false);
    });

    it('defaults to true when capability not specified', () => {
      vi.mocked(jmapClient.getAccountCapability).mockReturnValue(null);

      const { result } = renderHook(() => useContactsLimits(), {
        wrapper: createWrapper(),
      });

      expect(result.current.canCreateAddressBook()).toBe(true);
    });
  });
});
